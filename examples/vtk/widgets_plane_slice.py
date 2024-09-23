# import os
from pathlib import Path

from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client
from trame_vtklocal.widgets import vtklocal
from trame.decorators import TrameApp, change

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa

from vtkmodules.vtkCommonColor import vtkNamedColors
from vtkmodules.vtkCommonDataModel import vtkPlane
from vtkmodules.vtkFiltersCore import vtkCutter
from vtkmodules.vtkFiltersSources import vtkSphereSource
from vtkmodules.vtkIOXML import vtkXMLPolyDataReader
from vtkmodules.vtkInteractionWidgets import (
    vtkImplicitPlaneRepresentation,
    vtkImplicitPlaneWidget2,
)
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkRenderer,
)


def create_vtk_pipeline(file_to_load):
    colors = vtkNamedColors()

    fp = None
    if file_to_load:
        fp = Path(file_to_load)
        if not (fp.is_file() and fp.suffix == ".vtp"):
            print("Expected an existing file name with extension .vtp:")
            print("Got", fp)
            return

    # Setup a visualization pipeline.
    source = (
        vtkXMLPolyDataReader(file_name=fp)
        if file_to_load
        else vtkSphereSource(radius=10.0)
    )
    source.Update()

    input_bounds = source.output.bounds
    plane = vtkPlane(
        origin=(
            0.5 * (input_bounds[0] + input_bounds[1]),
            0.5 * (input_bounds[2] + input_bounds[3]),
            0.5 * (input_bounds[4] + input_bounds[5]),
        )
    )

    clipper = vtkCutter(
        cut_function=plane,
        input_connection=source.output_port,
    )

    # Create a mapper and actor.
    mapper = vtkPolyDataMapper(input_connection=clipper.output_port)
    actor = vtkActor(mapper=mapper)
    actor.property.line_width = 3
    actor.property.color = (0, 0, 0)
    mapper2 = vtkPolyDataMapper(input_connection=source.output_port)
    actor2 = vtkActor(mapper=mapper2)
    actor2.property.opacity = 0.2

    # A renderer and render window
    renderer = vtkRenderer(background=colors.GetColor3d("SlateGray"))
    renderer.AddActor(actor)
    # renderer.AddActor(actor2)
    ren_win = vtkRenderWindow()
    ren_win.AddRenderer(renderer)

    # An interactor
    iren = vtkRenderWindowInteractor(render_window=ren_win)
    iren.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

    rep = vtkImplicitPlaneRepresentation(
        place_factor=1.25,
        outline_translation=False,
    )
    rep.PlaceWidget(input_bounds)
    rep.normal = plane.normal
    rep.origin = plane.origin

    plane_widget = vtkImplicitPlaneWidget2(interactor=iren, representation=rep)

    renderer.ResetCamera(input_bounds)
    ren_win.Render()

    plane_widget.On()

    return ren_win, plane_widget, plane


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


@TrameApp()
class App:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")

        self.server.cli.add_argument("--data")
        args, _ = self.server.cli.parse_known_args()
        self.render_window, self.widget, self.plane = create_vtk_pipeline(args.data)

        # Allocation state variable for widget state
        self.state.plane_widget = None

        # Build UI
        self.html_view = None
        self.ui = self._ui()

    @property
    def state(self):
        return self.server.state

    @change("plane_widget")
    def _on_widget_update(self, plane_widget, **_):
        if plane_widget is None:
            return

        # update cutting plane
        self.plane.normal = plane_widget.get("normal")
        self.plane.origin = plane_widget.get("origin")

        # prevent requesting geometry too often
        self.html_view.update_throttle()

    def toggle_listeners(self):
        if self.state.wasm_listeners is not None and len(self.state.wasm_listeners):
            self.state.wasm_listeners = {}
        else:
            self.state.wasm_listeners = {
                self.widget_id: {
                    "InteractionEvent": {
                        "plane_widget": {
                            "normal": (
                                self.widget_id,
                                "WidgetRepresentation",
                                "Normal",
                            ),
                            "origin": (
                                self.widget_id,
                                "WidgetRepresentation",
                                "Origin",
                            ),
                        }
                    }
                }
            }

    def one_time_update(self):
        self.html_view.eval(
            {
                "plane_widget": {
                    "origin": (self.widget_id, "WidgetRepresentation", "Origin"),
                    "normal": (self.widget_id, "WidgetRepresentation", "Normal"),
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
                "Update cut",
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
