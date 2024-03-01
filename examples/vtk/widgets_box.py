from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtk as vtk_widgets
from trame_vtklocal.widgets import vtklocal

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa

from vtkmodules.vtkCommonColor import vtkNamedColors
from vtkmodules.vtkFiltersSources import vtkConeSource
from vtkmodules.vtkInteractionWidgets import vtkBoxWidget
from vtkmodules.vtkCommonTransforms import vtkTransform
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkRenderer,
)

WASM = False


def boxCallback(obj, event):
    t = vtkTransform()
    obj.GetTransform(t)
    obj.GetProp3D().SetUserTransform(t)


def create_vtk_pipeline():
    colors = vtkNamedColors()

    # Create a Cone
    cone = vtkConeSource()
    cone.SetResolution(20)
    coneMapper = vtkPolyDataMapper()
    coneMapper.SetInputConnection(cone.GetOutputPort())
    coneActor = vtkActor()
    coneActor.SetMapper(coneMapper)
    coneActor.GetProperty().SetColor(colors.GetColor3d("BurlyWood"))

    # A renderer and render window
    renderer = vtkRenderer()
    renderer.SetBackground(colors.GetColor3d("Blue"))
    renderer.AddActor(coneActor)

    renwin = vtkRenderWindow()
    renwin.AddRenderer(renderer)
    renwin.SetWindowName("BoxWidget")

    # An interactor
    interactor = vtkRenderWindowInteractor()
    interactor.SetRenderWindow(renwin)
    interactor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

    # A Box widget
    boxWidget = vtkBoxWidget()
    boxWidget.SetInteractor(interactor)
    boxWidget.SetProp3D(coneActor)
    boxWidget.SetPlaceFactor(1.25)  # Make the box 1.25x larger than the actor
    boxWidget.PlaceWidget()
    boxWidget.On()

    # Connect the event to a function
    if not WASM:
        boxWidget.AddObserver("InteractionEvent", boxCallback)

    return renwin, boxWidget


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


class App:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")
        self.render_window, self.widget = create_vtk_pipeline()
        self.html_view = None
        self.ui = self._ui()

    def _ui(self):
        with DivLayout(self.server) as layout:
            client.Style("body { margin: 0; }")
            with html.Div(
                style="position: absolute; left: 0; top: 0; width: 100vw; height: 100vh;"
            ):
                if WASM:
                    self.html_view = vtklocal.LocalView(self.render_window)
                else:
                    self.html_view = vtk_widgets.VtkRemoteView(self.render_window)

        return layout


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = App()
    app.server.start()
