#!/usr/bin/env -S uv run --script
# /// script
#
# requires-python = ">=3.10"
#
# dependencies = [
#   "trame>=3.13",
#   "trame-vtklocal>=1.3",
#   "vtk>=9.7",
# ]
#
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
#
# ///
# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa: F401
import vtkmodules.vtkInteractionStyle  # noqa: F401

from trame.app import TrameApp
from trame.decorators import change, trigger
from trame.ui.html import DivLayout
from vtkmodules.vtkFiltersSources import vtkConeSource
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)

from trame.widgets import client, html, vtklocal

CLIENT_TYPE = "vue3"

# -----------------------------------------------------------------------------
# VTK pipeline
# -----------------------------------------------------------------------------


def create_vtk_pipeline():
    renderer = vtkRenderer()
    renderWindow = vtkRenderWindow()
    renderWindow.AddRenderer(renderer)

    renderWindowInteractor = vtkRenderWindowInteractor()
    renderWindowInteractor.SetRenderWindow(renderWindow)
    renderWindowInteractor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

    cone = vtkConeSource()

    mapper = vtkPolyDataMapper()
    mapper.SetInputConnection(cone.GetOutputPort())

    actor = vtkActor()
    actor.SetMapper(mapper)

    renderer.AddActor(actor)
    renderer.SetBackground(0.1, 0.2, 0.4)
    renderer.ResetCamera()

    return renderWindow, cone, actor


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


class ConeApp(TrameApp):
    def __init__(self, server=None):
        super().__init__(server, client_type=CLIENT_TYPE)
        self.render_window, self.cone, self.actor = create_vtk_pipeline()
        self.server.state.update(dict(mem_blob=0, mem_vtk=0))
        self._build_ui()
        # print(self.ui)

    @trigger("export")
    def export(self, format):
        return self.ctx.view.export(format)

    def reset_camera(self):
        self.ctx.view.reset_camera()

    @change("resolution")
    def on_resolution_change(self, resolution, **_):
        self.cone.SetResolution(int(resolution))
        self.ctx.view.update_throttle(
            resolution=resolution
        )  # provide custom content on update

    @change("opacity")
    def on_opacity_change(self, opacity, **_):
        self.actor.property.opacity = float(opacity)
        self.ctx.view.update_throttle(
            opacity=opacity
        )  # provide custom content on update

    def _build_ui(self):
        with DivLayout(self.server) as self.ui:
            self.ui.root.style = "height:100vh;"
            client.Style("body { margin: 0; }")

            vtklocal.LocalView(
                self.render_window,
                ctx_name="view",
                throttle_rate=20,
                cache_size=("cache", 0),
                emit_memory=True,
                memory_vtk="mem_vtk = $event",
                memory_arrays="mem_blob = $event",
                updated="console.log('updated', $event)",  # print custom update content
            )
            html.Div(
                "Scene: {{ (mem_vtk / 1024).toFixed(1) }}KB - "
                "Arrays: {{ (mem_blob / 1024).toFixed(1) }}KB - "
                "cache: {{ (cache/1024).toFixed(1) }}KB ",
                style=(
                    "position: absolute; top: 1rem; left: 1rem;"
                    "z-index: 10; background: white;"
                    "padding: 1rem; border-radius: 1rem;"
                ),
            )
            html.Label(
                "Cone resolution {{resolution}}",
                style="position: absolute; top: 1rem; right: 1rem; z-index: 10; color: white;",
            )
            html.Input(
                type="range",
                v_model=("resolution", 6),
                min=3,
                max=60,
                step=1,
                style="position: absolute; top: 2rem; right: 1rem; z-index: 10;",
            )
            html.Label(
                "Opacity {{opacity}}",
                style="position: absolute; top: 3rem; right: 1rem; z-index: 10; color: white;",
            )
            html.Input(
                type="range",
                v_model=("opacity", 1),
                min=0.01,
                max=1,
                step=0.01,
                style="position: absolute; top: 4rem; right: 1rem; z-index: 10;",
            )
            html.Label(
                "Cache {{ (cache / 1024).toFixed(1) }} KB",
                style="position: absolute; top: 5rem; right: 1rem; z-index: 10; color: white;",
            )
            html.Input(
                type="range",
                v_model=("cache", 0),
                min=0,
                max=100000,
                step=1000,
                style="position: absolute; top: 6rem; right: 1rem; z-index: 10;",
            )
            html.Button(
                "Export json",
                click="utils.download('scene-wasm.json', trigger('export', ['json']), 'application/octet-stream')",
                style="position: absolute; top: 6rem; left: 1rem; z-index: 10;",
            )
            html.Button(
                "Export zip",
                click="utils.download('scene-wasm.zip', trigger('export', ['zip']), 'application/octet-stream')",
                style="position: absolute; top: 6rem; left: 7rem; z-index: 10;",
            )
            html.Button(
                "Reset Camera",
                click=self.reset_camera,
                style="position: absolute; top: 6rem; left: 14rem; z-index: 10;",
            )


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = ConeApp()
    app.server.start()
