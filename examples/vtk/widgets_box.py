from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client
from trame_vtklocal.widgets import vtklocal
from trame.decorators import TrameApp, change

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa

from vtkmodules.vtkCommonColor import vtkNamedColors
from vtkmodules.vtkCommonTransforms import vtkTransform
from vtkmodules.vtkFiltersSources import vtkConeSource
from vtkmodules.vtkInteractionWidgets import vtkBoxWidget2, vtkBoxRepresentation
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkRenderer,
)


def create_vtk_pipeline():
    colors = vtkNamedColors()

    # Create a Cone
    cone = vtkConeSource()
    cone.SetResolution(20)
    coneMapper = vtkPolyDataMapper()
    coneMapper.SetInputConnection(cone.GetOutputPort())
    coneActor = vtkActor(user_transform=vtkTransform())
    coneActor.SetMapper(coneMapper)
    coneActor.GetProperty().SetColor(colors.GetColor3d("BurlyWood"))

    cone.Update()
    input_bounds = cone.output.bounds

    # A renderer and render window
    renderer = vtkRenderer()
    renderer.SetBackground(colors.GetColor3d("Blue"))
    renderer.AddActor(coneActor)

    renwin = vtkRenderWindow(off_screen_rendering=True)
    renwin.AddRenderer(renderer)

    # An interactor
    interactor = vtkRenderWindowInteractor()
    interactor.SetRenderWindow(renwin)
    interactor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

    # A Box widget
    rep = vtkBoxRepresentation(place_factor=2)
    rep.PlaceWidget(input_bounds)

    boxWidget = vtkBoxWidget2(interactor=interactor, representation=rep)

    renderer.ResetCamera()
    renwin.Render()

    boxWidget.On()

    return renwin, boxWidget, coneActor


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


@TrameApp()
class App:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")

        # enable shared array buffer
        self.server.http_headers.shared_array_buffer = True

        # Allocation state variable for widget state
        self.state.widget_state = None

        self.render_window, self.widget, self.actor = create_vtk_pipeline()
        self.html_view = None
        self.ui = self._ui()

    @property
    def state(self):
        return self.server.state

    @change("widget_state")
    def _on_widget_update(self, widget_state, **_):
        if widget_state is None:
            return

        # Get new widget corners from state.
        self.widget.representation.corners = widget_state.get("corners")
        # Compute user transform for the actor from the new corners.
        self.widget.representation.GetTransform(self.actor.user_transform)

        self.html_view.update_throttle()

    def toggle_listeners(self):
        if self.state.wasm_listeners is not None and len(self.state.wasm_listeners):
            self.state.wasm_listeners = {}
        else:
            self.state.wasm_listeners = {
                self.widget_id: {
                    "InteractionEvent": {
                        "widget_state": {
                            "corners": (
                                self.widget_id,
                                "WidgetRepresentation",
                                "Corners",
                            ),
                        }
                    }
                }
            }

    def one_time_update(self):
        self.html_view.eval(
            {
                "widget_state": {
                    "corners": (
                        self.widget_id,
                        "WidgetRepresentation",
                        "Corners",
                    ),
                }
            }
        )

    def _ui(self):
        with DivLayout(self.server) as layout:
            client.Style("body { margin: 0; }")
            html.Button(
                "Toggle listeners",
                click=self.toggle_listeners,
                style="position: absolute; left: 1rem; top: 1rem; z-index: 10;",
            )
            html.Button(
                "Update transformation matrix",
                click=self.one_time_update,
                style="position: absolute; right: 1rem; top: 1rem; z-index: 10;",
            )
            with html.Div(
                style="position: absolute; left: 0; top: 0; width: 100vw; height: 100vh;"
            ):
                self.html_view = vtklocal.LocalView(
                    self.render_window,
                    throttle_rate=20,
                    listeners=("wasm_listeners", {}),
                )
                self.widget_id = self.html_view.register_widget(self.widget)

        return layout


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = App()
    app.server.start()
