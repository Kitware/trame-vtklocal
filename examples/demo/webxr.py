import vtk

from trame.app import TrameApp
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtklocal
from trame.decorators import change

FULL_SCREEN = "position:absolute; left:0; top:0; width:100vw; height:100vh;"
TOP_RIGHT = "position: absolute; top: 1rem; right: 1rem; z-index: 999999;"
TOP_LEFT = "position: absolute; top: 1rem; left: 1rem; z-index: 999999;"
TOP_CENTER = "position: absolute; top: 1rem; left: 50%; z-index: 999999; transform: translateX(-50%);"
OFF_SCREEN = "position: none;"


def create_vtk_pipeline():
    renderer = vtk.vtkWebXRRenderer()
    rw = vtk.vtkWebXRRenderWindow()
    rw.AddRenderer(renderer)

    # WebXR Emulator doesn't work with MultiSamples>0
    rw.SetMultiSamples(0)

    rwi = vtk.vtkWebXRRenderWindowInteractor()
    rwi.SetRenderWindow(rw)

    cone = vtk.vtkConeSource()

    mapper = vtk.vtkPolyDataMapper(input_connection=cone.output_port)
    actor = vtk.vtkActor(mapper=mapper)

    renderer.AddActor(actor)
    renderer.background = (0.1, 0.2, 0.4)
    # Reset camera to place actors a little bit higher
    renderer.ResetCamera()
    # Prevent camera issues when no actors are visible in the viewport
    renderer.GetCullers().RemoveAllItems()

    light = vtk.vtkLight()
    light.SetColor(1, 1, 1)
    light.SetPosition(0, 3, 0)
    light.SetIntensity(1)
    light.SetLightTypeToSceneLight()
    renderer.AddLight(light)

    return rw, cone, actor


class WasmApp(TrameApp):
    def __init__(self, name=None):
        super().__init__(name)
        self.render_window, self.cone, self.cone_actor = create_vtk_pipeline()
        self._build_ui()
        self.state.cone_actor = {"position": None}

    @property
    def state(self):
        return self.server.state

    @property
    def ctrl(self):
        return self.server.controller

    @change("resolution")
    def on_resolution_change(self, resolution, **_):
        self.cone.SetResolution(int(resolution))
        self.ctrl.view_update()

    def startxr(self):
        self.ctrl.startxr()

    def stopxr(self):
        self.ctrl.stopxr()

    def _build_ui(self):
        with DivLayout(self.server):
            client.Style("body { margin: 0; }")

            with html.Div(style=TOP_CENTER):
                html.Button(
                    "StartXR",
                    click=self.startxr,
                )
                html.Button(
                    "StopXR",
                    click=self.stopxr,
                )
            html.Input(
                type="range",
                v_model=("resolution", 6),
                min=3,
                max=60,
                step=1,
                style=TOP_LEFT,
            )

            # use style=OFF_SCREEN when not using the WebXR Emulator to hide the canvas
            with html.Div(style=FULL_SCREEN):
                with vtklocal.LocalView(
                    self.render_window,
                    v_if=("enable_view", True),
                    # use auto_resize=False when using WebXR (except when using the WebXR Emulator)
                    auto_resize=False,
                ) as view:
                    view.update_throttle.rate = 20  # max update rate
                    self.ctrl.view_update = view.update_throttle
                    self.ctrl.startxr = view.startXR
                    self.ctrl.stopxr = view.stopXR
                    cone_id = view.register_vtk_object(self.cone_actor)
                    view.listeners = (
                        "listeners",
                        {
                            cone_id: {
                                "ModifiedEvent": {
                                    "cone_actor": {
                                        "position": (cone_id, "Position"),
                                    },
                                },
                            },
                        },
                    )


def main():
    app = WasmApp()
    app.server.start()


if __name__ == "__main__":
    main()
