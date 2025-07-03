import pathlib
import vtk
from addonModules.addonStyle import (
    HighlightPickedActorStyle,
    RegisterClasses_addonStyle,
)  # type: ignore

from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtklocal
from trame.decorators import TrameApp

FULL_SCREEN = "position:absolute; left:0; top:0; width:100vw; height:100vh;"
TOP_RIGHT = "position: absolute; top: 1rem; right: 1rem; z-index: 10;"
TOP_LEFT = "position: absolute; top: 1rem; left: 1rem; z-index: 10;"
TOP_CENTER = "position: absolute; top: 1rem; left: 50%; z-index: 10; transform: translateX(-50%);"

NUMBER_OF_SPHERES = 10

WASM_DIR = pathlib.Path(__file__).parent / "install" / "Release" / "wasm32" / "bin"
WASM_BASE_NAME = "addon"


def create_vtk_pipeline():
    # A renderer and render window
    renderer = vtk.vtkRenderer()
    colors = vtk.vtkNamedColors()
    renderer.SetBackground(colors.GetColor3d("SteelBlue"))

    renwin = vtk.vtkRenderWindow()
    renwin.AddRenderer(renderer)
    renwin.SetSize(640, 480)
    renwin.SetWindowName("HighlightPickedActor")

    # An interactor
    interactor = vtk.vtkRenderWindowInteractor()
    interactor.SetRenderWindow(renwin)

    # add the custom style
    style = HighlightPickedActorStyle()
    style.SetDefaultRenderer(renderer)
    interactor.SetInteractorStyle(style)

    randomSequence = vtk.vtkMinimalStandardRandomSequence()
    # randomSequence.SetSeed(1043618065)
    # randomSequence.SetSeed(5170)
    randomSequence.SetSeed(8775070)
    # Add spheres to play with
    for i in range(NUMBER_OF_SPHERES):
        source = vtk.vtkSphereSource()

        # random position and radius
        x = randomSequence.GetRangeValue(-5.0, 5.0)
        randomSequence.Next()
        y = randomSequence.GetRangeValue(-5.0, 5.0)
        randomSequence.Next()
        z = randomSequence.GetRangeValue(-5.0, 5.0)
        randomSequence.Next()
        radius = randomSequence.GetRangeValue(0.5, 1.0)
        randomSequence.Next()

        source.SetRadius(radius)
        source.SetCenter(x, y, z)
        source.SetPhiResolution(11)
        source.SetThetaResolution(21)

        mapper = vtk.vtkPolyDataMapper()
        mapper.SetInputConnection(source.GetOutputPort())
        actor = vtk.vtkActor()
        actor.SetMapper(mapper)

        r = randomSequence.GetRangeValue(0.4, 1.0)
        randomSequence.Next()
        g = randomSequence.GetRangeValue(0.4, 1.0)
        randomSequence.Next()
        b = randomSequence.GetRangeValue(0.4, 1.0)
        randomSequence.Next()

        actor.GetProperty().SetDiffuseColor(r, g, b)
        actor.GetProperty().SetDiffuse(0.8)
        actor.GetProperty().SetSpecular(0.5)
        actor.GetProperty().SetSpecularColor(colors.GetColor3d("White"))
        actor.GetProperty().SetSpecularPower(30.0)

        renderer.AddActor(actor)

    return renwin


@TrameApp()
class CustomInteractorStyleApp:
    def __init__(self, server=None):
        self.server = get_server(server)
        self.render_window = create_vtk_pipeline()
        self._build_ui()

    @property
    def ctrl(self):
        return self.server.controller

    def _build_ui(self):
        with DivLayout(self.server):
            client.Style("body { margin: 0; }")

            html.Button(
                "Reset Camera",
                click=self.ctrl.view_reset_camera,
                style=TOP_RIGHT,
            )
            with html.Div(style=FULL_SCREEN):
                with vtklocal.LocalView(
                    self.render_window,
                    addon_serdes_registrars=[RegisterClasses_addonStyle],
                    wasm_dir=WASM_DIR,
                    wasm_base_name=WASM_BASE_NAME,
                ) as view:
                    self.ctrl.view_update = view.update_throttle
                    self.ctrl.view_reset_camera = view.reset_camera


def main():
    app = CustomInteractorStyleApp()
    app.server.start()


if __name__ == "__main__":
    main()
