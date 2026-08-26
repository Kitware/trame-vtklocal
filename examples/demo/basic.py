#!/usr/bin/env -S uv run --script
#
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "trame>=3.13.2",
#     "trame-vtklocal>=1.3",
#     "vtk>=9.7",
# ]
#
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
# ///

import vtk

from trame.app import TrameApp
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtklocal
from trame.decorators import change

CLIENT_TYPE = "vue3"  # vue3 / vue2

TOOLBAR_STYLE = """
    position: absolute;
    top: 1rem;
    left: 1rem;
    right: 1rem;
    z-index: 10;
    display: flex;
    gap: 1rem;
"""


class ConeApp(TrameApp):
    def __init__(self, server=None):
        super().__init__(server, client_type=CLIENT_TYPE)
        self._setup_vtk()
        self._build_ui()

    def _setup_vtk(self):
        renderer = vtk.vtkRenderer()
        rw = vtk.vtkRenderWindow()
        rw.AddRenderer(renderer)
        rwi = vtk.vtkRenderWindowInteractor(render_window=rw)
        rwi.interactor_style.SetCurrentStyleToTrackballCamera()

        cone = vtk.vtkConeSource()

        mapper = vtk.vtkPolyDataMapper(input_connection=cone.output_port)
        actor = vtk.vtkActor(mapper=mapper)

        renderer.AddActor(actor)
        renderer.background = (0.1, 0.2, 0.4)
        renderer.ResetCamera()

        self.render_window = rw
        self.cone = cone

    @change("resolution")
    def on_resolution_change(self, resolution, **_):
        self.cone.SetResolution(int(resolution))
        self.ctx.view.update_throttle()

    def _build_ui(self):
        with DivLayout(self.server) as self.ui:
            client.Style("body { margin: 0; }")
            self.ui.root.style = "height:100vh;"

            vtklocal.LocalView(
                self.render_window,
                ctx_name="view",
                throttle_rate=20,
                v_if=("enable_view", True),
            )

            with html.Div(style=TOOLBAR_STYLE):
                html.Input(
                    type="range",
                    v_model=("resolution", 6),
                    min=3,
                    max=60,
                    step=1,
                    style="flex:1",
                )
                html.Button(
                    "Reset Camera",
                    click=self.ctx.view.reset_camera,
                )
                html.Button(
                    "Toggle component",
                    click="enable_view = !enable_view",
                )


def main():
    app = ConeApp()
    app.server.start()


if __name__ == "__main__":
    main()
