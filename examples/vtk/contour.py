#!/usr/bin/env -S uv run --script
# /// script
#
# requires-python = ">=3.10"
#
# dependencies = [
#   "trame>=3.13",
#   "trame-vtklocal>=1.4",
#   "vtk>=9.7",
# ]
#
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
#
# ///

import time

import vtkmodules.vtkInteractionStyle  # noqa: F401
import vtkmodules.vtkRenderingOpenGL2  # noqa: F401

from vtkmodules.vtkCommonCore import vtkSMPTools
from vtkmodules.vtkFiltersCore import vtkFlyingEdges3D
from vtkmodules.vtkFiltersModeling import vtkOutlineFilter
from vtkmodules.vtkImagingCore import vtkRTAnalyticSource
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkRenderer,
)

from trame.app import TrameApp
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtklocal
from trame.decorators import change

# -----------------------------------------------------------------------------
# User settings
# -----------------------------------------------------------------------------
DIMENSION = 100  # Drive data size
THROTTLE_RATE = 20  # time per seconds
PROGRESS_DELAY_MS = 100  # show downloading progress after {n} ms
MAX_MEMORY_USAGE = (2_000_000_000,)  # 2 GB
# -----------------------------------------------------------------------------

# Enable threading in VTK
smp = vtkSMPTools()
smp.SetBackend("STDThread")


class ContourApp(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)
        self._setup_vtk()
        self._build_ui()

    def _setup_vtk(self):
        renderer = vtkRenderer()
        render_window = vtkRenderWindow()
        render_window.AddRenderer(renderer)
        render_window.OffScreenRenderingOn()

        render_window_interactor = vtkRenderWindowInteractor()
        render_window_interactor.SetRenderWindow(render_window)
        render_window_interactor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

        source = vtkRTAnalyticSource(
            whole_extent=(
                -DIMENSION,
                DIMENSION,
                -DIMENSION,
                DIMENSION,
                0,
                DIMENSION,
            ),
        )

        iso = vtkFlyingEdges3D()
        iso.SetValue(0, 150)
        isoMapper = vtkPolyDataMapper()
        isoMapper.SetInputConnection(iso.GetOutputPort())
        isoMapper.ScalarVisibilityOff()
        source >> iso >> isoMapper

        outline = vtkOutlineFilter()
        outlineMapper = vtkPolyDataMapper()
        source >> outline >> outlineMapper

        renderer.AddActor(vtkActor(mapper=outlineMapper))
        renderer.AddActor(vtkActor(mapper=isoMapper))

        self.render_window = render_window
        self.contour = iso

    def _build_ui(self):
        self.state.mem_vtk = 0
        self.state.mem_total = 0
        with DivLayout(self.server) as self.ui:
            client.Style("html,body{margin:0;padding:0}")
            self.ui.root.style = "height:100vh"
            vtklocal.LocalView(
                self.render_window,
                ctx_name="view",
                throttle_rate=THROTTLE_RATE,
                cache_size=MAX_MEMORY_USAGE,
                progress_enabled=True,
                progress_delay=PROGRESS_DELAY_MS,
                emit_memory=True,
                memory_vtk="mem_vtk = $event",
                memory_arrays="mem_total = $event",
            )

            with html.Div(
                style="position:absolute;top:1rem;left:1rem;right:1rem;z-index:100;"
            ):
                html.Input(
                    type="range",
                    v_model_number=("contour", 150),
                    min="35",
                    max="260",
                    step="1",
                    style="width: 100%;",
                )
                for msg in [
                    "Current scene size: {{ utils.fmt.bytes(mem_vtk) }}",
                    "Total memory used in cache: {{ utils.fmt.bytes(mem_total) }}",
                    f"Volume size: {DIMENSION * 2}x{DIMENSION * 2}x{DIMENSION}",
                ]:
                    html.Div(msg, style="color: white;")

    @change("contour")
    def _on_contour(self, contour, **_):
        self.contour.SetValue(0, contour)
        t0 = time.perf_counter()
        self.contour.Update()
        t1 = time.perf_counter()
        print(f"Computed in {t1 - t0:.3f}s")
        self.ctx.view.update_throttle()


def main():
    app = ContourApp()
    app.server.start()


if __name__ == "__main__":
    main()
