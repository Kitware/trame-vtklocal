import vtk

from trame.app import TrameApp
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtklocal
from trame.decorators import change

FULL_SCREEN = "position:absolute; left:0; top:0; width:100vw; height:100vh;"
TOP_RIGHT = "position: absolute; top: 1rem; right: 1rem; z-index: 10;"
TOP_LEFT = "position: absolute; top: 1rem; left: 1rem; z-index: 10;"
TOP_CENTER = "position: absolute; top: 1rem; left: 50%; z-index: 10; transform: translateX(-50%);"


def create_vtk_pipeline():
    renderer = vtk.vtkRenderer()
    rw = vtk.vtkRenderWindow()
    rw.AddRenderer(renderer)
    rwi = vtk.vtkRenderWindowInteractor(render_window=rw)
    rwi.interactor_style.SetCurrentStyleToTrackballCamera()

    sphere = vtk.vtkSphereSource()

    mapper = vtk.vtkPolyDataMapper(input_connection=sphere.output_port)
    actor = vtk.vtkActor(mapper=mapper)

    renderer.AddActor(actor)
    renderer.background = (0.1, 0.2, 0.4)
    renderer.ResetCamera()

    return rw, sphere


class WasmApp(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)
        self.render_window, self.sphere = create_vtk_pipeline()
        self._build_ui()

    @change("resolution")
    def on_resolution_change(self, resolution, **_):
        self.sphere.SetPhiResolution(int(resolution))
        self.sphere.SetThetaResolution(int(resolution))
        self.ctrl.view_update()

    def _build_ui(self):
        with DivLayout(self.server):
            client.Style("body { margin: 0; }")

            html.Button(
                "Reset Camera",
                click=self.ctrl.view_reset_camera,
                style=TOP_RIGHT,
            )
            html.Button(
                "Toggle component",
                click="enable_view = !enable_view",
                style=TOP_CENTER,
            )
            html.Input(
                type="range",
                v_model=("resolution", 30),
                min=30,
                max=260,
                step=10,
                style=TOP_LEFT,
            )

            with html.Div(style=FULL_SCREEN):
                with vtklocal.LocalView(
                    self.render_window,
                    progress_delay=100,  # Try to set it to 0 and 500
                    progress_enabled=True,
                    cache_size=0,
                    v_if=("enable_view", True),
                ) as view:
                    view.update_throttle.rate = 20  # max update rate
                    self.ctrl.view_update = view.update_throttle
                    self.ctrl.view_reset_camera = view.reset_camera


def main():
    app = WasmApp()
    app.server.start()


if __name__ == "__main__":
    main()
