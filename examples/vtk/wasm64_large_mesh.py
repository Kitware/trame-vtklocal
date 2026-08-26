#!/usr/bin/env -S uv run --script
# /// script
#
# requires-python = ">=3.10"
#
# dependencies = [
#   "numpy>=2.5.2",
#   "trame>=3.13",
#   "trame-vtklocal>=1.3",
#   "vtk>=9.7",
# ]
#
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
#
# ///
"""Demonstrate why the wasm64 (memory64) VTK runtime is needed.

The example builds a multi-block triangulated surface whose total memory
footprint is larger than 4 GiB (the addressable limit of a wasm32 module) and
mirrors it into the browser with ``vtklocal.LocalView``.

    python wasm64_large_mesh.py             # wasm64 runtime -> works
    python wasm64_large_mesh.py --wasm32    # wasm32 runtime -> out of memory

Most of the payload lives in per-point simulation fields rather than in the
geometry itself: every field is resident on the client, so switching the
coloring array is a client side operation with no new data transfer, while the
GPU only ever uploads the geometry and the single active array.

NOTE: the dataset is generated on the server and streamed to the client, so the
server needs roughly ``--size-gb`` of RAM and the initial synchronization moves
that many bytes over the websocket. Use ``--size-gb`` to scale it down when
experimenting (values <= 4 will also run in wasm32).
"""

import math

import numpy as np

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from trame.app import TrameApp
from trame.decorators import change
from trame.ui.html import DivLayout
from vtkmodules.util.numpy_support import numpy_to_vtk
from vtkmodules.vtkCommonCore import VTK_TYPE_INT32, vtkPoints
from vtkmodules.vtkCommonDataModel import vtkCellArray, vtkPolyData
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)

from trame.widgets import client, html, vtklocal

GiB = 1024**3
ANGLE = np.pi * (3 - np.sqrt(5))

FULL_SCREEN = "position:absolute; left:0; top:0; width:100vw; height:100vh;"
TOP_LEFT = (
    "position:absolute; top:1rem; left:1rem; z-index:10;"
    "background:white; padding:0.75rem 1rem; border-radius:0.5rem;"
    "font-family:monospace; font-size:0.8rem;"
)
TOP_RIGHT = (
    "position:absolute; top:1rem; right:1rem; z-index:10;"
    "background:white; padding:0.75rem 1rem; border-radius:0.5rem;"
    "display:flex; gap:0.5rem; align-items:center;"
)

# -----------------------------------------------------------------------------
# Dataset generation
# -----------------------------------------------------------------------------


def field_name(index):
    return f"field_{index:02d}"


def bytes_per_point(nb_fields):
    """Points (3 x float32) + 2 triangles + nb_fields x float64 per point."""
    return 3 * 4 + 2 * (3 * 4) + 2 * 4 + nb_fields * 8


def build_block(resolution, origin, nb_fields):
    """Triangulated height field of resolution x resolution points."""
    axis = np.linspace(0, 1, resolution, dtype=np.float32)
    gx, gy = np.meshgrid(axis, axis, indexing="ij")

    coordinates = np.empty((resolution * resolution, 3), dtype=np.float32)
    coordinates[:, 0] = gx.ravel() + origin[0]
    coordinates[:, 1] = gy.ravel() + origin[1]
    np.sin(6 * gx.ravel(), out=coordinates[:, 2])
    coordinates[:, 2] *= np.cos(6 * gy.ravel())
    coordinates[:, 2] *= 0.15

    points = vtkPoints()
    points.SetData(numpy_to_vtk(coordinates, deep=0))

    # Two triangles per quad, 32 bit connectivity/offsets to keep the client
    # side arrays as compact as the server side ones.
    quad = np.arange(resolution - 1, dtype=np.int32)
    ii, jj = np.meshgrid(quad, quad, indexing="ij")
    p0 = (ii * resolution + jj).ravel()
    p1 = p0 + resolution
    p2 = p1 + 1
    p3 = p0 + 1

    connectivity = np.empty((p0.size * 2, 3), dtype=np.int32)
    connectivity[0::2, 0] = p0
    connectivity[0::2, 1] = p1
    connectivity[0::2, 2] = p2
    connectivity[1::2, 0] = p0
    connectivity[1::2, 1] = p2
    connectivity[1::2, 2] = p3
    connectivity = connectivity.ravel()
    offsets = np.arange(p0.size * 2 + 1, dtype=np.int32) * 3

    polys = vtkCellArray()
    polys.SetData(
        numpy_to_vtk(offsets, deep=0, array_type=VTK_TYPE_INT32),
        numpy_to_vtk(connectivity, deep=0, array_type=VTK_TYPE_INT32),
    )

    mesh = vtkPolyData(points=points, polys=polys)

    # Per point simulation fields: this is where the bulk of the memory goes.
    ranges = []
    u = gx.ravel().astype(np.float64) + origin[0]
    v = gy.ravel().astype(np.float64) + origin[1]
    radius = np.hypot(u - origin[0] - 0.5, v - origin[1] - 0.5)
    for index in range(nb_fields):
        angle = index * ANGLE
        frequency = 2 * np.pi * (1.5 + 1.7 * index)
        if index % 2:
            values = np.sin(frequency * radius + angle)
        else:
            values = np.sin(frequency * (u * np.cos(angle) + v * np.sin(angle)))

        array = numpy_to_vtk(values, deep=0)
        array.SetName(field_name(index))
        mesh.GetPointData().AddArray(array)
        ranges.append((float(values.min()), float(values.max())))

    return mesh, ranges


def create_vtk_pipeline(size_gb, block_mb, nb_fields):
    per_point = bytes_per_point(nb_fields)
    block_bytes = block_mb * 1024 * 1024
    resolution = max(2, int(math.sqrt(block_bytes / per_point)))
    nb_blocks = max(1, math.ceil(size_gb * GiB / block_bytes))
    blocks_per_row = max(1, int(math.ceil(math.sqrt(nb_blocks))))

    renderer = vtkRenderer(background=(0.1, 0.2, 0.4))
    render_window = vtkRenderWindow()
    render_window.AddRenderer(renderer)
    interactor = vtkRenderWindowInteractor(render_window=render_window)
    interactor.interactor_style.SetCurrentStyleToTrackballCamera()

    mappers = []
    field_ranges = [(float("inf"), float("-inf"))] * nb_fields
    for index in range(nb_blocks):
        origin = (index % blocks_per_row, index // blocks_per_row)
        mesh, ranges = build_block(resolution, origin, nb_fields)
        field_ranges = [
            (min(current[0], new[0]), max(current[1], new[1]))
            for current, new in zip(field_ranges, ranges)
        ]

        mapper = vtkPolyDataMapper(
            input_data_object=mesh,
            scalar_visibility=True,
        )
        mapper.SetScalarModeToUsePointFieldData()
        renderer.AddActor(vtkActor(mapper=mapper))
        mappers.append(mapper)

        print(
            f"block {index + 1}/{nb_blocks}: "
            f"{mesh.GetNumberOfPoints():,} points, "
            f"{mesh.GetNumberOfCells():,} cells",
            end="\r",
        )

    nb_points = nb_blocks * resolution * resolution
    nb_cells = nb_blocks * 2 * (resolution - 1) ** 2
    total_bytes = nb_points * per_point

    print(
        f"\nDataset: {nb_blocks} blocks, "
        f"{nb_points:,} points, {nb_cells:,} cells, "
        f"{nb_fields} point fields => {total_bytes / GiB:.2f} GiB"
    )

    renderer.ResetCamera()

    return render_window, mappers, field_ranges, total_bytes


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


class LargeMeshApp(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)

        self.server.cli.add_argument(
            "--wasm32",
            action="store_true",
            help="Use the wasm32 runtime. Expected to run out of memory when "
            "the dataset is bigger than 4 GiB. Default is wasm64.",
        )
        self.server.cli.add_argument(
            "--size-gb",
            type=float,
            default=4.5,
            help="Approximate dataset size in GiB (default: 4.5)",
        )
        self.server.cli.add_argument(
            "--block-mb",
            type=int,
            default=192,
            help="Approximate size of a single mesh block in MiB (default: 192)",
        )
        self.server.cli.add_argument(
            "--fields",
            type=int,
            default=24,
            help="Number of float64 point data fields per block (default: 24)",
        )
        args, _ = self.server.cli.parse_known_args()

        self.wasm_mode = "wasm32" if args.wasm32 else "wasm64"
        (
            self.render_window,
            self.mappers,
            self.field_ranges,
            self.total_bytes,
        ) = create_vtk_pipeline(args.size_gb, args.block_mb, args.fields)

        print(f"Runtime: {self.wasm_mode}")
        if self.total_bytes >= 4 * GiB and self.wasm_mode == "wasm32":
            print(
                "The dataset does not fit in the 4 GiB address space of a "
                "wasm32 module: the client is expected to abort while "
                "allocating memory. Drop --wasm32 to run in wasm64."
            )

        self.state.update(
            dict(
                mem_blob=0,
                mem_vtk=0,
                wasm_mode=self.wasm_mode,
                dataset_size=f"{self.total_bytes / GiB:.2f}",
                color_fields=[field_name(i) for i in range(args.fields)],
            )
        )

        # Initial coloring, before the scene gets mirrored to the client
        self._select_color_array(field_name(0))

        self.html_view = None
        self.mapper_ids = []
        self.client_ready = False
        self._build_ui()

    def _select_color_array(self, name):
        index = int(name.rsplit("_", 1)[-1])
        for mapper in self.mappers:
            mapper.SelectColorArray(name)
            mapper.SetScalarRange(*self.field_ranges[index])

    def _on_view_updated(self, **_):
        self.client_ready = True

    @change("color_field")
    def _on_color_field(self, color_field, **_):
        # Keep the server side pipeline in sync so any later state push
        # matches what the client is already showing.
        self._select_color_array(color_field)

        if not self.client_ready:
            return

        # Every field is already resident in the client memory: the coloring
        # switch is a pure client side call on the mirrored mappers, neither
        # state nor blob travels over the wire.
        index = int(color_field.rsplit("_", 1)[-1])
        scalar_range = self.field_ranges[index]
        self.ctrl.js_color_by(
            {
                "ref": self.html_view.ref_name,
                "mappers": self.mapper_ids,
                "name": color_field,
                "min": scalar_range[0],
                "max": scalar_range[1],
            }
        )

    def reset_camera(self):
        self.html_view.reset_camera()

    def _build_ui(self):
        with DivLayout(self.server) as self.ui:
            client.Style("body { margin: 0; }")
            with html.Div(style=FULL_SCREEN):
                self.html_view = vtklocal.LocalView(
                    self.render_window,
                    throttle_rate=20,
                    config=(f"{{ mode: '{self.wasm_mode}' }}",),
                    progress_enabled=True,
                    progress_delay=100,
                    emit_memory=True,
                    memory_vtk="mem_vtk = $event",
                    updated=self._on_view_updated,
                )
                self.mapper_ids = [
                    self.html_view.get_wasm_id(mapper) for mapper in self.mappers
                ]

            # Client side coloring: reach the mirrored mappers through
            # getVtkObject() and drive them directly inside the wasm runtime.
            client.Script("""
async function updateColorArray(refName, mapperIds, name, min, max) {
    const view = window.trame.refs[refName];
    if (!view) {
        return;
    }
    try {
        for (const mapperId of mapperIds) {
            const mapper = view.getVtkObject(mapperId);
            await mapper.selectColorArray(name);
            await mapper.setScalarRange(min, max);
        }
        view.render();
    } catch (err) {
        console.error("Failed to update color array", err);
    }
}""")
            self.ctrl.js_color_by = client.JSEval(
                exec="""utils.get('updateColorArray')(
  $event.ref,
  $event.mappers,
  $event.name,
  $event.min,
  $event.max
)""",
            ).exec

            html.Div(
                "{{ wasm_mode }}|dataset {{ dataset_size }} GiB<br>"
                "Scene: {{ (mem_vtk / (1024*1024)).toFixed(1) }} MB",
                style=TOP_LEFT,
            )
            with html.Div(style=TOP_RIGHT):
                html.Div("Color by")
                with html.Select(v_model=("color_field", field_name(0))):
                    html.Option("{{ name }}", v_for="name in color_fields", key="name")
                html.Button("Reset Camera", click=self.reset_camera)


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = LargeMeshApp()
    app.server.start()
