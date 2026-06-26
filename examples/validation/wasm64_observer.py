#!/usr/bin/env -S uv run --script
#
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "trame>=3.13.2",
#     "trame-vtklocal>=1.0.1",
#     "vtk==9.6.20260517.dev0",
# ]
#
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
# ///


# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from trame.app import TrameApp
from trame.decorators import change
from trame.ui.html import DivLayout
from vtkmodules.vtkFiltersSources import vtkConeSource
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)

from trame.widgets import client, html
from trame_vtklocal.widgets import vtklocal
from trame_vtklocal.utils import ui

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


class DemoApp(TrameApp):
    def __init__(self, server=None):
        # dispose after unmount should only work with vue3
        super().__init__(server, client_type=CLIENT_TYPE)
        self.render_window, self.cone, self.actor = create_vtk_pipeline()
        self._build_ui()

    def reset_camera(self):
        self.ctx.view.reset_camera()

    @change("resolution")
    def on_resolution_change(self, resolution, **_):
        self.cone.SetResolution(int(resolution))
        self.ctx.view.update_throttle(
            resolution=resolution
        )  # provide custom content on update

    def update_camera(self, state):
        self.html_view.vtk_update_from_state(state)

    def _build_ui(self):
        with DivLayout(self.server) as self.ui:
            client.Style("body { margin: 0; }")
            with html.Div(
                style=ui.FULL_SCREEN,
                v_if=("mounted", True),
            ):
                vtklocal.LocalView(
                    self.render_window,
                    ctx_name="view",
                    throttle_rate=20,
                    config=("{ mode: 'wasm64' }",),
                    camera=(self.update_camera, "[$event]"),
                    # camera="console.log($event)",
                    updated="console.log('updated', $event)",  # print custom update content
                )
            with ui.Toolbar():
                html.Button(
                    "Reset Camera",
                    click=self.reset_camera,
                )
                with ui.Element("Resolution"):
                    html.Input(
                        type="range",
                        v_model=("resolution", 6),
                        min=3,
                        max=60,
                        step=1,
                    )

                ui.Separator()

                with ui.Element("Mounted"):
                    html.Input(
                        type="checkbox",
                        v_model=("mounted", True),
                    )

                ui.Separator()

                html.Button(
                    "Dispose Runtime",
                    click=self.ctx.view.dispose_wasm_runtime,
                )
                html.Button(
                    "Dispose Session",
                    click=self.ctx.view.dispose_remote_session,
                )


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = DemoApp()
    app.server.start()
