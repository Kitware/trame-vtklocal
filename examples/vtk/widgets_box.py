#!/usr/bin/env -S uv run --script
# /// script
#
# requires-python = ">=3.10"
#
# dependencies = [
#   "trame>=3.13",
#   "trame-vtklocal>=1.3",
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

from trame.app import TrameApp
from trame.decorators import change
from trame.ui.html import DivLayout
from vtkmodules.vtkCommonColor import vtkNamedColors
from vtkmodules.vtkCommonTransforms import vtkTransform
from vtkmodules.vtkFiltersSources import vtkConeSource
from vtkmodules.vtkInteractionWidgets import vtkBoxRepresentation, vtkBoxWidget2
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)

from trame.widgets import client, html, vtklocal


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
    interactor = vtkRenderWindowInteractor(track_interactor_observer_instances=True)
    interactor.SetRenderWindow(renwin)
    interactor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

    # A Box widget
    rep = vtkBoxRepresentation(place_factor=2)
    rep.PlaceWidget(input_bounds)

    boxWidget = vtkBoxWidget2(interactor=interactor)
    boxWidget.SetRepresentation(rep)

    renderer.ResetCamera()
    renwin.Render()

    boxWidget.On()

    return renwin, boxWidget, coneActor


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------

TOOLBAR_CSS = """
    position: absolute;
    top: 1rem;
    left: 1rem;
    right: 1rem;
    z-index: 10;
    display: flex;
    gap: 1rem;
"""


class BoxWidgetApp(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)
        # Allocation state variable for widget state
        self.state.widget_state = None

        self.render_window, self.widget, self.actor = create_vtk_pipeline()
        self._build_ui()

    @change("widget_state")
    def _on_widget_update(self, widget_state, **_):
        if widget_state is None:
            return

        # Get new widget corners from state.
        self.widget.representation.corners = widget_state.get("corners")
        # Compute user transform for the actor from the new corners.
        self.widget.representation.GetTransform(self.actor.user_transform)

        self.ctx.view.update_throttle()

    def toggle_listeners(self):
        if self.state.wasm_listeners is not None and len(self.state.wasm_listeners):
            self.state.wasm_listeners = {}
        else:
            widget_id = self.ctx.view.object_manager.GetId(self.widget)
            assert widget_id is not None and widget_id > 0
            self.state.wasm_listeners = {
                widget_id: {
                    "InteractionEvent": {
                        "widget_state": {
                            "corners": (
                                widget_id,
                                "WidgetRepresentation",
                                "Corners",
                            ),
                        }
                    }
                }
            }

    def one_time_update(self):
        widget_id = self.ctx.view.object_manager.GetId(self.widget)
        self.ctx.view.eval(
            {
                "widget_state": {
                    "corners": (
                        widget_id,
                        "WidgetRepresentation",
                        "Corners",
                    ),
                }
            }
        )

    def _build_ui(self):
        with DivLayout(self.server) as self.ui:
            self.ui.root.style = "height: 100vh;"
            client.Style("body { margin: 0; }")

            vtklocal.LocalView(
                self.render_window,
                ctx_name="view",
                throttle_rate=20,
                listeners=("wasm_listeners", {}),
            )

            with html.Div(style=TOOLBAR_CSS):
                html.Button(
                    "Toggle listeners (currently {{ Object.keys(wasm_listeners).length === 0 ? 'Off' : 'On' }})",
                    click=self.toggle_listeners,
                )
                html.Button(
                    "Update transformation matrix",
                    click=self.one_time_update,
                )


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = BoxWidgetApp()
    app.server.start()
