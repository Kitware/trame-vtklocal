#!/usr/bin/env -S uv run --script
# /// script
#
# requires-python = ">=3.10"
#
# dependencies = [
#   "numpy",
#   "trame>=3.13",
#   "trame-vtklocal>=1.3",
#   "vtk>=9.7",
# ]
#
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
#
# ///
"""
Dynamic point cloud benchmark for trame-vtklocal.

Every frame the server moves each point randomly, assigns new random colors,
serializes the vtkPolyData, and pushes it to the VTK.wasm client. The next frame
starts only after the client reports that it rendered the previous one, so
the measured updates/s is the maximum rate at which new data can go through
the full pipeline:

    numpy -> vtk arrays -> vtkObjectManager (serialize + hash) -> wslink
          -> browser (msgpack decode) -> wasm (register blobs, deserialize)
          -> render -> "updated" event back to Python

This is a data update rate, not a render rate: the client renders camera
interaction locally and stays smooth even when updates/s is low.

Run:
    python dynamic_point_cloud.py --points 500000 [--step 100000] [--profile-log bench.log]

The trame profiler is enabled. Its trace goes to stderr, or to --profile-log.
View it with: python -m trame.tools.profiler --data bench.log
"""

import asyncio
import time
from functools import wraps

import numpy as np

from trame.app import TrameApp
from trame.ui.html import DivLayout
from trame.widgets import client, html, vtklocal
from trame_common.utils import profiler
from trame_vtklocal.module.protocol import ObjectManagerAPI

import vtkmodules.vtkRenderingOpenGL2  # noqa: F401
from vtkmodules.util.numpy_support import numpy_to_vtk, numpy_to_vtkIdTypeArray
from vtkmodules.vtkCommonCore import vtkPoints
from vtkmodules.vtkCommonDataModel import vtkCellArray, vtkPolyData
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleTrackballCamera  # noqa: F401
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkRenderer,
)

WARMUP_FRAMES = 5  # frames skipped after a resize (topology + first push)
ROLLING_FRAMES = 30  # frames averaged in the live panel
UI_REFRESH_S = 0.25
BYTES_PER_POINT = 3 * 4 + 3 * 1  # float32 xyz + uint8 rgb

STAGES = [
    ("generate", "numpy random walk + colors, app work"),
    ("serialize", "vtkObjectManager.UpdateStatesFromObjects"),
    ("notify", "js_call(update) -> client asks get_status"),
    ("rpc", "server get_status + get_batch handlers"),
    ("transfer", "wslink send, msgpack decode, blobs -> wasm heap"),
    ("deserialize_render", "wasm UpdateObjectsFromStates + render"),
    ("ack", "client 'updated' event -> python"),
    ("prune", "vtkObjectManager.PruneUnusedBlobs"),
]

# Client-side timestamps taken from the LocalView progress callback. The
# callback fires once the status arrives, once per state/blob registered in
# wasm, and a final time (active=false) after deserialization and render.
CLIENT_PROBE_JS = """
window.__vtklocalBench = {
  first: 0, last: 0, done: 0,
  now() { return performance.timeOrigin + performance.now(); },
  progress(e) {
    const t = this.now();
    if (!e.active) { this.done = t; return; }
    if (e.state.current + e.hash.current > 0) {
      if (!this.first) this.first = t;
      this.last = t;
    }
  },
  take() {
    const r = { first: this.first, last: this.last, done: this.done };
    this.first = this.last = this.done = 0;
    return r;
  },
};

// Client render rate: count display refreshes (requestAnimationFrame ticks)
// during which WebGL issued at least one draw call. This is what the user
// sees on screen, whether the draw came from a data update or from camera
// interaction. Written straight to the DOM to stay off the network.
(function () {
  const bench = window.__vtklocalBench;
  let drawn = false;
  const DRAWS = ["drawArrays", "drawElements", "drawArraysInstanced",
                 "drawElementsInstanced", "drawRangeElements"];
  for (const Ctx of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!Ctx) continue;
    for (const name of DRAWS) {
      const draw = Ctx.prototype[name];
      if (!draw) continue;
      Ctx.prototype[name] = function (...args) {
        drawn = true;
        return draw.apply(this, args);
      };
    }
  }
  let frames = 0;
  let t0 = performance.now();
  function tick(now) {
    if (drawn) {
      frames++;
      drawn = false;
    }
    if (now - t0 >= 500) {
      bench.fps = (frames * 1000) / (now - t0);
      frames = 0;
      t0 = now;
      const el = document.getElementById("vtklocal-bench-fps");
      if (el) el.textContent = bench.fps.toFixed(1);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
"""

PANEL_STYLE = """
position:absolute; top:1rem; left:1rem; z-index:10; width:38rem;
max-height:calc(100vh - 2rem); overflow:auto;
background:rgba(20,22,28,0.85); color:#e8e8e8; border-radius:8px;
padding:0.75rem 1rem; font:12px/1.4 ui-monospace,Menlo,monospace;
"""

CSS = """
body { margin: 0; }
.bench table { width:100%; border-collapse:collapse; margin:0.25rem 0 0.75rem; }
.bench td, .bench th { padding:1px 4px; text-align:right; white-space:nowrap; }
.bench td:first-child, .bench th:first-child { text-align:left; }
.bench td.stage { white-space:normal; }
.bench th { color:#9aa; font-weight:normal; border-bottom:1px solid #444; }
.bench .bar { height:8px; background:#4c9be8; border-radius:2px; }
.bench .big { font-size:20px; font-weight:bold; }
.bench button { font:inherit; padding:4px 10px; margin-right:6px; cursor:pointer; }
.bench .muted { color:#9aa; }
"""


# -----------------------------------------------------------------------------
# Server RPC instrumentation
# -----------------------------------------------------------------------------


class RpcProbe:
    """Collects timing of the vtklocal RPC handlers for the in-flight frame"""

    def __init__(self):
        self.frame = None

    def on_status(self, t0, t1, _result):
        if self.frame is not None:
            self.frame.status_start = self.frame.status_start or t0
            self.frame.rpc_ms += (t1 - t0) * 1000

    def on_batch(self, t0, t1, result):
        if self.frame is not None:
            self.frame.rpc_ms += (t1 - t0) * 1000
            self.frame.batch_calls += 1
            self.frame.blob_bytes += sum(
                memoryview(b).nbytes for b in result.get("hashes", {}).values()
            )


RPC_PROBE = RpcProbe()


def instrument_rpc(method_name, label, callback):
    # wslink collects RPC handlers from the class when the client connects, so
    # patching the class here (with @wraps keeping `_wslinkuris`) is enough.
    original = getattr(ObjectManagerAPI, method_name)
    timer = profiler.Timer(label)

    @wraps(original)
    def wrapper(self, *args, **kwargs):
        t0 = time.time()
        with timer:
            result = original(self, *args, **kwargs)
        callback(t0, time.time(), result)
        return result

    setattr(ObjectManagerAPI, method_name, wrapper)


instrument_rpc("get_status", "vtklocal.rpc.get_status", RPC_PROBE.on_status)
instrument_rpc("get_batch", "vtklocal.rpc.get_batch", RPC_PROBE.on_batch)


# -----------------------------------------------------------------------------
# Data
# -----------------------------------------------------------------------------


class PointCloud:
    """vtkPolyData whose point and color arrays are numpy views updated in place"""

    def __init__(self, n_points, seed=0):
        self.rng = np.random.default_rng(seed)
        self.polydata = vtkPolyData()
        self.n_points = 0
        self.positions = np.zeros((0, 3), dtype=np.float32)
        self.colors = np.zeros((0, 3), dtype=np.uint8)
        self._noise = np.zeros((0, 3), dtype=np.float32)
        self.resize(n_points)

    def resize(self, n_points):
        n_old = self.n_points
        positions = np.empty((n_points, 3), dtype=np.float32)
        positions[: min(n_old, n_points)] = self.positions[:n_points]
        if n_points > n_old:
            positions[n_old:] = self.rng.standard_normal(
                (n_points - n_old, 3), dtype=np.float32
            )
        colors = np.empty((n_points, 3), dtype=np.uint8)
        colors.reshape(-1)[:] = np.frombuffer(self.rng.bytes(3 * n_points), np.uint8)

        # Keep python references alive: the VTK arrays share numpy memory.
        self.positions = positions
        self.colors = colors
        self._noise = np.empty_like(positions)
        self.n_points = n_points

        points = vtkPoints()
        points.SetData(numpy_to_vtk(positions, deep=False))

        vtk_colors = numpy_to_vtk(colors, deep=False)
        vtk_colors.SetName("colors")
        self._vtk_colors = vtk_colors

        # One vertex cell per point. Topology only changes on resize, so its
        # blob hash is stable and the client keeps it cached between frames.
        verts = vtkCellArray()
        verts.SetData(
            numpy_to_vtkIdTypeArray(np.arange(n_points + 1, dtype=np.int64), deep=True),
            numpy_to_vtkIdTypeArray(np.arange(n_points, dtype=np.int64), deep=True),
        )

        self.polydata.SetPoints(points)
        self.polydata.SetVerts(verts)
        self.polydata.point_data.SetScalars(vtk_colors)
        self.polydata.Modified()

    def animate(self, step=0.02, pull=0.995):
        # Random walk with a weak pull toward the origin so the cloud stays put.
        self.rng.standard_normal(out=self._noise, dtype=np.float32)
        self._noise *= step
        self.positions *= pull
        self.positions += self._noise
        self.colors.reshape(-1)[:] = np.frombuffer(
            self.rng.bytes(3 * self.n_points), np.uint8
        )
        self.polydata.GetPoints().GetData().Modified()
        self.polydata.GetPoints().Modified()
        self._vtk_colors.Modified()

    @property
    def payload_bytes(self):
        return self.n_points * BYTES_PER_POINT


# -----------------------------------------------------------------------------
# Frame bookkeeping
# -----------------------------------------------------------------------------


class Frame:
    __slots__ = [
        "id",
        "n_points",
        "t_start",
        "t_sent",
        "status_start",
        "stages",
        "rpc_ms",
        "batch_calls",
        "blob_bytes",
        "total_ms",
    ]

    def __init__(self, frame_id, n_points):
        self.id = frame_id
        self.n_points = n_points
        self.t_start = time.time()
        self.t_sent = 0.0
        self.status_start = 0.0
        self.stages = {}
        self.rpc_ms = 0.0
        self.batch_calls = 0
        self.blob_bytes = 0
        self.total_ms = 0.0

    def finalize(self, client_ts, t_recv, prune_ms):
        """Turn server/client timestamps (epoch ms) into per-stage durations"""
        ms = 1000.0
        first = client_ts.get("first") or 0
        last = client_ts.get("last") or first
        done = client_ts.get("done") or last
        status_start = self.status_start or self.t_sent

        s = self.stages
        s["notify"] = (status_start - self.t_sent) * ms
        s["rpc"] = self.rpc_ms
        s["transfer"] = max(0.0, last - status_start * ms - self.rpc_ms)
        s["deserialize_render"] = max(0.0, done - last)
        s["ack"] = max(0.0, t_recv * ms - done)
        s["prune"] = prune_ms
        self.total_ms = (t_recv - self.t_start) * ms + prune_ms


class LevelStats:
    """Aggregated frames recorded at one point count"""

    def __init__(self, n_points):
        self.n_points = n_points
        self.seen = 0
        self.count = 0
        self.total_ms = 0.0
        self.work_ms = 0.0

    def add(self, frame):
        self.seen += 1
        if self.seen <= WARMUP_FRAMES:
            return
        self.count += 1
        self.total_ms += frame.total_ms
        self.work_ms += frame.stages["generate"]

    @property
    def mean_ms(self):
        return self.total_ms / self.count if self.count else 0.0

    def row(self):
        mean = self.mean_ms
        mb = self.n_points * BYTES_PER_POINT / 1e6
        overhead = mean - self.work_ms / self.count
        return {
            "points": f"{self.n_points:,}",
            "frames": self.count,
            "ms": f"{mean:.1f}",
            "ups": f"{1000 / mean:.1f}" if mean else "-",
            "mbs": f"{mb / (overhead / 1000):.0f}" if overhead > 0 else "-",
        }


def fit_capacity(levels):
    """Least squares fit total_ms = a + b * n_points over the measured levels"""
    pts = [(lv.n_points, lv.mean_ms) for lv in levels if lv.count >= 10]
    if len(pts) < 2:
        return None
    n = np.array([p[0] for p in pts], dtype=float)
    t = np.array([p[1] for p in pts], dtype=float)
    b, a = np.polyfit(n, t, 1)
    if b <= 0:
        return None

    def capacity(ups):
        return max(0, int((1000.0 / ups - a) / b))

    return {
        "fixed_ms": f"{a:.2f}",
        "ns_per_point": f"{b * 1e6:.1f}",
        "at30": f"{capacity(30):,}",
        "at60": f"{capacity(60):,}",
    }


# -----------------------------------------------------------------------------
# Application
# -----------------------------------------------------------------------------


class PointCloudBenchmark(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)

        cli = self.server.cli
        cli.add_argument("--points", type=int, default=100_000, help="Initial points")
        cli.add_argument(
            "--step", type=int, default=100_000, help="Points per +N click"
        )
        cli.add_argument("--profile-log", help="Write profiler trace to this file")
        args, _ = cli.parse_known_args()

        logger = profiler.enable()
        if args.profile_log:
            self._profile_file = open(args.profile_log, "w")  # noqa: SIM115
            logger.use_print(file=self._profile_file)

        self.step_size = args.step
        self.cloud = PointCloud(args.points)
        self.pending_points = None
        self.running = True
        self.inflight = None
        self.next_frame_id = 1
        self.recent = []
        self.levels = []

        self._timer_generate = profiler.Timer("vtklocal.bench.generate")
        self._timer_serialize = profiler.Timer("vtklocal.bench.serialize")
        self._timer_prune = profiler.Timer("vtklocal.bench.prune")

        self._setup_vtk()
        self._build_ui()
        self._new_level()
        self.server.controller.on_server_ready.add(self._on_server_ready)

    # VTK ----------------------------------------------------------------------

    def _setup_vtk(self):
        mapper = vtkPolyDataMapper()
        mapper.SetInputData(self.cloud.polydata)
        mapper.SetColorModeToDirectScalars()
        mapper.SetScalarModeToUsePointData()

        actor = vtkActor(mapper=mapper)
        actor.property.point_size = 2

        renderer = vtkRenderer(background=(0.1, 0.1, 0.12))
        renderer.AddActor(actor)
        renderer.ResetCamera()

        render_window = vtkRenderWindow()
        render_window.AddRenderer(renderer)
        interactor = vtkRenderWindowInteractor(render_window=render_window)
        interactor.interactor_style.SetCurrentStyleToTrackballCamera()

        self.render_window = render_window

    # Frame loop -----------------------------------------------------------------

    def _on_server_ready(self, **_):
        asyncio.get_running_loop().create_task(self._publish_stats())

    def _schedule_step(self):
        asyncio.get_running_loop().call_soon(self._step)

    def _step(self):
        if not self.running or self.inflight is not None:
            return

        if self.pending_points is not None:
            if self.pending_points != self.cloud.n_points:
                self.cloud.resize(self.pending_points)
                self._new_level()
            self.pending_points = None

        frame = Frame(self.next_frame_id, self.cloud.n_points)
        self.next_frame_id += 1

        with self._timer_generate:
            self.cloud.animate()
        frame.stages["generate"] = self._timer_generate.dt

        self.inflight = frame
        RPC_PROBE.frame = frame
        with self._timer_serialize:
            # LocalView.update() = UpdateStatesFromObjects + js_call("update")
            self.ctx.view.update(frame=frame.id)
        frame.stages["serialize"] = self._timer_serialize.dt
        frame.t_sent = time.time()

    def on_client_updated(self, options, client_ts):
        t_recv = time.time()
        frame_id = (options or {}).get("frame")

        if frame_id is None:
            # Initial mount or page reload: (re)start the loop from scratch.
            self.inflight = None
            RPC_PROBE.frame = None
            self._schedule_step()
            return

        frame = self.inflight
        if frame is None or frame.id != frame_id:
            return

        with self._timer_prune:
            self.ctx.view.object_manager.PruneUnusedBlobs()
        frame.finalize(client_ts or {}, t_recv, self._timer_prune.dt)
        profiler.LOGGER.action("vtklocal.bench.frame", frame.total_ms)

        self.inflight = None
        RPC_PROBE.frame = None
        self.recent.append(frame)
        del self.recent[:-ROLLING_FRAMES]
        self.levels[-1].add(frame)
        self._schedule_step()

    # Controls -------------------------------------------------------------------

    def add_points(self):
        self._change_points(+self.step_size)

    def remove_points(self):
        self._change_points(-self.step_size)

    def _change_points(self, delta):
        base = self.pending_points or self.cloud.n_points
        self.pending_points = max(1, base + delta)
        self.state.n_points_pending = self.pending_points

    def toggle_running(self):
        self.running = not self.running
        self.state.running = self.running
        if self.running:
            self._schedule_step()

    def _new_level(self):
        if self.levels and self.levels[-1].count:
            row = self.levels[-1].row()
            print(
                f"[bench] points={row['points']:>12} updates={row['frames']:>5} "
                f"update={row['ms']:>8} ms updates/s={row['ups']:>7} overhead MB/s={row['mbs']:>6}",
                flush=True,
            )
        if self.levels and not self.levels[-1].count:
            self.levels.pop()

        # Coming back to a measured point count keeps adding to its row so the
        # fit sees each count once. Warmup is skipped again after the resize.
        level = next(
            (lv for lv in self.levels if lv.n_points == self.cloud.n_points), None
        )
        if level is None:
            level = LevelStats(self.cloud.n_points)
        else:
            self.levels.remove(level)
            level.seen = 0
        self.levels.append(level)
        self.recent.clear()

    # Stats ------------------------------------------------------------------------

    async def _publish_stats(self):
        while True:
            await asyncio.sleep(UI_REFRESH_S)
            if not self.recent:
                continue
            with self.state:
                self.state.update(self._stats())

    def _stats(self):
        frames = self.recent
        k = len(frames)
        total = sum(f.total_ms for f in frames) / k
        stage_ms = {
            name: sum(f.stages.get(name, 0) for f in frames) / k for name, _ in STAGES
        }
        overhead = total - stage_ms["generate"]
        payload_mb = self.cloud.payload_bytes / 1e6

        return {
            "n_points": f"{self.cloud.n_points:,}",
            "n_points_pending": self.pending_points,
            "payload_mb": f"{payload_mb:.1f}",
            "ups": f"{1000 / total:.1f}",
            "frame_ms": f"{total:.1f}",
            "overhead_ms": f"{overhead:.1f}",
            "overhead_mbs": f"{payload_mb / (overhead / 1000):.0f}"
            if overhead > 0
            else "-",
            "batch_calls": f"{sum(f.batch_calls for f in frames) / k:.1f}",
            "wire_mb": f"{sum(f.blob_bytes for f in frames) / k / 1e6:.1f}",
            "stages": [
                {
                    "name": name,
                    "help": help,
                    "ms": f"{stage_ms[name]:.2f}",
                    "pct": f"{100 * stage_ms[name] / total:.0f}",
                }
                for name, help in STAGES
            ],
            "levels": [
                lv.row()
                for lv in sorted(self.levels, key=lambda lv: lv.n_points)
                if lv.count
            ],
            "fit": fit_capacity(self.levels),
        }

    # UI -----------------------------------------------------------------------------

    def _build_ui(self):
        self.state.update(
            {
                "running": True,
                "n_points": f"{self.cloud.n_points:,}",
                "n_points_pending": None,
                "payload_mb": "-",
                "ups": "-",
                "frame_ms": "-",
                "overhead_ms": "-",
                "overhead_mbs": "-",
                "batch_calls": "-",
                "wire_mb": "-",
                "stages": [],
                "levels": [],
                "fit": None,
            }
        )

        with DivLayout(self.server) as self.ui:
            self.ui.root.style = "height:100vh;position:relative;"
            client.Style(CSS)
            client.Script(CLIENT_PROBE_JS)

            vtklocal.LocalView(
                self.render_window,
                ctx_name="view",
                cache_size=0,  # drop previous frames' blobs on the client
                progress="window.__vtklocalBench && window.__vtklocalBench.progress($event)",
                updated=(
                    self.on_client_updated,
                    "[$event, window.__vtklocalBench && window.__vtklocalBench.take()]",
                ),
            )

            with html.Div(classes="bench", style=PANEL_STYLE):
                with html.Div(style="margin-bottom:0.5rem;"):
                    html.Button(
                        "{{ running ? 'Pause' : 'Resume' }}",
                        click=self.toggle_running,
                    )
                    html.Button(f"−{self.step_size:,}", click=self.remove_points)
                    html.Button(f"+{self.step_size:,}", click=self.add_points)
                    html.Span(
                        "→ {{ n_points_pending.toLocaleString() }} on next update",
                        v_if="n_points_pending",
                        classes="muted",
                    )

                with html.Div(style="display:flex;gap:1.5rem;margin-bottom:0.5rem;"):
                    with html.Div():
                        with html.Div(classes="big"):
                            html.Span("-", id="vtklocal-bench-fps")
                            html.Span(" fps")
                        html.Div("client render rate", classes="muted")
                    with html.Div():
                        html.Div("{{ ups }} updates/s", classes="big")
                        html.Div("{{ frame_ms }} ms / update", classes="muted")
                    with html.Div():
                        html.Div("{{ n_points }} pts", classes="big")
                        html.Div(
                            "{{ payload_mb }} MB / update, {{ wire_mb }} MB blobs sent",
                            classes="muted",
                        )

                html.Div(
                    "Overhead (update − app work): {{ overhead_ms }} ms "
                    "→ {{ overhead_mbs }} MB/s, {{ batch_calls }} get_batch RPC / update"
                )

                with html.Table():
                    with html.Tr():
                        html.Th("stage")
                        html.Th("ms")
                        html.Th("%")
                        html.Th("", style="width:35%;")
                    with html.Tr(v_for="s in stages", key="s.name"):
                        with html.Td(classes="stage"):
                            html.Span("{{ s.name }} ")
                            html.Span("({{ s.help }})", classes="muted")
                        html.Td("{{ s.ms }}")
                        html.Td("{{ s.pct }}")
                        with html.Td():
                            html.Div(classes="bar", style=("{ width: s.pct + '%' }",))

                html.Div(
                    f"Per point count (first {WARMUP_FRAMES} updates skipped)",
                    classes="muted",
                )
                with html.Table():
                    with html.Tr():
                        html.Th("points")
                        html.Th("updates")
                        html.Th("ms")
                        html.Th("updates/s")
                        html.Th("MB/s")
                    with html.Tr(v_for="l in levels", key="l.points"):
                        html.Td("{{ l.points }}")
                        html.Td("{{ l.frames }}")
                        html.Td("{{ l.ms }}")
                        html.Td("{{ l.ups }}")
                        html.Td("{{ l.mbs }}")

                with html.Div(v_if="fit"):
                    html.Div(
                        "Fit: {{ fit.fixed_ms }} ms fixed + {{ fit.ns_per_point }} ns/point"
                    )
                    html.Div(
                        "Realtime capacity: {{ fit.at30 }} pts @ 30 updates/s, "
                        "{{ fit.at60 }} pts @ 60 updates/s",
                        classes="big",
                        style="font-size:14px;",
                    )
                html.Div(
                    "Add points at least twice to fit the per-point cost",
                    v_else=True,
                    classes="muted",
                )


def main():
    app = PointCloudBenchmark()
    app.server.start(backend="aiohttp")


if __name__ == "__main__":
    main()
