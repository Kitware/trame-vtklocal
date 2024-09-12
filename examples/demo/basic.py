import vtk

from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtklocal
from trame.decorators import TrameApp, change

FULL_SCREEN = "position:absolute; left:0; top:0; width:100vw; height:100vh;"
TOP_RIGHT = "position: absolute; top: 1rem; right: 1rem; z-index: 10;"
TOP_LEFT = "position: absolute; top: 1rem; left: 1rem; z-index: 10;"


def create_vtk_pipeline():
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

    return rw, cone


@TrameApp()
class WasmApp:
    def __init__(self, server=None):
        self.server = get_server(server)
        self.render_window, self.cone = create_vtk_pipeline()
        self._build_ui()

    @property
    def ctrl(self):
        return self.server.controller

    @change("resolution")
    def on_resolution_change(self, resolution, **_):
        self.cone.SetResolution(int(resolution))
        self.ctrl.view_update()

    def _build_ui(self):
        with DivLayout(self.server):
            client.Style("body { margin: 0; }")

            html.Button(
                "Reset Camera",
                click=self.ctrl.view_reset_camera,
                style=TOP_RIGHT,
            )
            html.Input(
                type="range",
                v_model=("resolution", 6),
                min=3,
                max=60,
                step=1,
                style=TOP_LEFT,
            )

            with html.Div(style=FULL_SCREEN):
                with vtklocal.LocalView(self.render_window) as view:
                    view.update_throttle.rate = 20  # max update rate
                    self.ctrl.view_update = view.update_throttle
                    self.ctrl.view_reset_camera = view.reset_camera


def main():
    app = WasmApp()
    app.server.start()


if __name__ == "__main__":
    main()
