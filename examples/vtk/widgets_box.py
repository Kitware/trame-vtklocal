import os
from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtk as vtk_widgets
from trame_vtklocal.widgets import vtklocal

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa

from vtkmodules.vtkCommonColor import vtkNamedColors
from vtkmodules.vtkFiltersSources import vtkConeSource
from vtkmodules.vtkInteractionWidgets import vtkBoxWidget2
from vtkmodules.vtkCommonTransforms import vtkTransform
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkRenderer,
)

WASM = "USE_WASM" in os.environ


def box_callback(obj, event):
    t = vtkTransform()
    obj.representation.GetTransform(t)
    box_callback.actor.user_transform = t


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
    coneMapper.Update()

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
    boxWidget = vtkBoxWidget2()
    boxWidget.SetInteractor(interactor)
    boxWidget.representation.SetPlaceFactor(1.0)
    boxWidget.representation.PlaceWidget(coneActor.bounds)

    boxWidget.On()

    # Connect the event to a function
    if not WASM:
        box_callback.actor = coneActor
        boxWidget.AddObserver("InteractionEvent", box_callback)

    return renwin, boxWidget


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


class App:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")

        # enable shared array buffer
        self.server.http_headers.shared_array_buffer = True

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
                    self.html_view.register_widget(self.widget)
                else:
                    self.html_view = vtk_widgets.VtkRemoteView(
                        self.render_window, interactive_ratio=1
                    )

        return layout


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = App()
    app.server.start()
