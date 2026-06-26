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

import asyncio

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from trame.app import TrameApp, asynchronous
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
from trame_vtklocal.utils import ui
from trame_vtklocal.widgets import vtklocal

CLIENT_TYPE = "vue3"


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


class CameraJumpValidation(TrameApp):
    def __init__(self, server=None):
        # dispose after unmount should only work with vue3
        super().__init__(server, client_type=CLIENT_TYPE)

        self.delta = 1
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

    @change("play")
    def on_play_change(self, play, **_):
        if play:
            asynchronous.create_task(self._animate())

    async def _animate(self):
        while self.state.play:
            await asyncio.sleep(0.01)

            resolution = self.cone.resolution

            if resolution > 59:
                self.delta = -1
            if resolution < 4:
                self.delta = +1

            with self.state:
                self.state.resolution = resolution + self.delta

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
                    config=["{ mode, rendering, exec }"],
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

                with ui.Element("Animate"):
                    html.Input(
                        type="checkbox",
                        v_model=("play", False),
                    )

                ui.Separator()

                ui.WasmConfig()

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


if __name__ == "__main__":
    app = CameraJumpValidation()
    app.server.start()
