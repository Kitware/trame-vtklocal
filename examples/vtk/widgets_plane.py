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
from vtkmodules.vtkFiltersCore import vtkClipPolyData
from vtkmodules.vtkFiltersSources import vtkSphereSource
from vtkmodules.vtkIOXML import vtkXMLPolyDataReader
from vtkmodules.vtkInteractionWidgets import (
    vtkImplicitPlaneRepresentation,
    vtkImplicitPlaneWidget2,
)
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkProperty,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkRenderer,
)


def create_vtk_pipeline(file_to_load):
    colors = vtkNamedColors()
    sphere_source = vtkSphereSource()
    sphere_source.SetRadius(10.0)
    sphere_source.Update()
    input_bounds = sphere_source.GetOutput().GetBounds()

    fp = None
    if file_to_load:
        fp = Path(file_to_load)
        if not (fp.is_file() and fp.suffix == ".vtp"):
            print("Expected an existing file name with extension .vtp:")
            print("Got", fp)
            return

    # Setup a visualization pipeline.
    plane = vtkPlane()
    clipper = vtkClipPolyData()
    clipper.SetClipFunction(plane)
    clipper.InsideOutOn()
    if file_to_load:
        reader = vtkXMLPolyDataReader()
        reader.SetFileName(fp)
        reader.Update()

        input_bounds = reader.GetOutput().GetBounds()
        clipper.SetInputConnection(reader.GetOutputPort())
    else:
        clipper.SetInputConnection(sphere_source.GetOutputPort())

    # Create a mapper and actor.
    mapper = vtkPolyDataMapper()
    mapper.SetInputConnection(clipper.GetOutputPort())
    actor = vtkActor()
    actor.SetMapper(mapper)

    back_faces = vtkProperty()
    back_faces.SetDiffuseColor(colors.GetColor3d("Gold"))

    actor.SetBackfaceProperty(back_faces)

    # A renderer and render window
    renderer = vtkRenderer()
    ren_win = vtkRenderWindow()
    ren_win.AddRenderer(renderer)
    ren_win.SetWindowName("ImplicitPlaneWidget2")

    renderer.AddActor(actor)
    renderer.SetBackground(colors.GetColor3d("SlateGray"))

    # An interactor
    iren = vtkRenderWindowInteractor()
    iren.GetInteractorStyle().SetCurrentStyleToTrackballCamera()
    iren.SetRenderWindow(ren_win)

    rep = vtkImplicitPlaneRepresentation()
    rep.SetPlaceFactor(1.25)  # This must be set prior to placing the widget
    rep.PlaceWidget(input_bounds)
    plane.SetOrigin(
        0.5 * (input_bounds[0] + input_bounds[1]),
        0.5 * (input_bounds[2] + input_bounds[3]),
        0.5 * (input_bounds[4] + input_bounds[5]),
    )
    rep.SetNormal(plane.GetNormal())
    rep.SetOrigin(plane.GetOrigin())

    plane_widget = vtkImplicitPlaneWidget2()
    plane_widget.SetInteractor(iren)
    plane_widget.SetRepresentation(rep)

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

        # enable shared array buffer
        self.server.http_headers.shared_array_buffer = True

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
        self.plane.SetNormal(plane_widget.get("normal"))
        self.plane.SetOrigin(plane_widget.get("origin"))

        # prevent requesting geometry too often
        self.html_view.render_throttle()

    def toggle_listeners(self):
        if self.state.wasm_listeners is not None and len(self.state.wasm_listeners):
            self.state.wasm_listeners = {}
        else:
            widget_id = self.html_view.get_wasm_id(self.widget)
            rep_id = self.html_view.get_wasm_id(self.widget.representation)
            self.state.wasm_listeners = {
                widget_id: {
                    "InteractionEvent": {
                        "plane_widget": {
                            rep_id: {
                                "Normal": "normal",
                                "Origin": "origin",
                            }
                        }
                    }
                }
            }

    def one_time_update(self):
        rep_id = self.html_view.get_wasm_id(self.widget.representation)
        self.html_view.eval(
            {
                "plane_widget": {
                    rep_id: {
                        "Normal": "normal",
                        "Origin": "origin",
                    }
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
                self.html_view.register_widget(self.widget)

        return layout


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = App()
    app.server.start()
