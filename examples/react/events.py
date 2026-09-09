#!/usr/bin/env -S uv run --script
# /// script
#
# requires-python = ">=3.10"
#
# dependencies = [
#   "trame>=4",
#   "trame-vtklocal>=1.5",
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

from trame.app import TrameApp, asynchronous
from trame.decorators import change
from trame.ui.html import DivLayout
from vtkmodules.vtkFiltersSources import vtkConeSource
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)

from trame.widgets import client, html, vtklocal, react


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
        super().__init__(server, client_type="react")
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

    def _test_status(self):
        print("Component is", "mounted" if self.ctx.view._mounted else "unmounted")

    @asynchronous.task
    async def invokes(self, value):
        # await asyncio.sleep(0.1)
        before = await self.ctx.view.invoke(self.actor.property, "GetColor")
        print(f"before ({value})", before)
        # await asyncio.sleep(0.5)
        set_reponse = await self.ctx.view.invoke(self.actor.property, "SetColor", value)
        print(f"set rep ({value})", set_reponse)
        self.ctx.view.render()

    def _build_ui(self):
        with DivLayout(self.server) as self.ui:
            self.ui.root.style = {"height": "100vh"}
            client.Style("body { margin: 0; }")

            with react.If(value=react.Bind("show_3d", show_3d=True)):
                vtklocal.LocalView(
                    self.render_window,
                    ctx_name="view",
                    throttle_rate=20,
                )
            with html.Div(
                style={
                    "position": "absolute",
                    "top": "1rem",
                    "left": "1rem",
                    "right": "1rem",
                    "zIndex": 10,
                    "background": "white",
                    "padding": "1rem",
                    "borderRadius": "1rem",
                },
            ):
                html.Input(
                    type="range",
                    value=react.Bind("resolution", resolution=6),
                    on_change=react.Callback(
                        "resolution = Number($event.target.value)"
                    ),
                    min=3,
                    max=60,
                    step=1,
                )
                html.Button(
                    "Test status",
                    on_click=react.Callback(self._test_status),
                )
                html.Button("Red", on_click=react.Callback(self.invokes, "[[1,0,0]]"))
                html.Button("Green", on_click=react.Callback(self.invokes, "[[0,1,0]]"))
                html.Button("Blue", on_click=react.Callback(self.invokes, "[[0,0,1]]"))

                html.Button(
                    "Toggle 3D view",
                    on_click=react.Callback("show_3d = !show_3d"),
                )

                html.Button(
                    "Reset Camera",
                    on_click=react.Callback(self.reset_camera),
                )


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = ConeApp()
    app.server.start()
