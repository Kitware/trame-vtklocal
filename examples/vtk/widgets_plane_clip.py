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
# import os
from pathlib import Path

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from trame.app import TrameApp
from trame.decorators import change
from trame.ui.html import DivLayout
from vtkmodules.vtkCommonColor import vtkNamedColors
from vtkmodules.vtkCommonDataModel import vtkPlane
from vtkmodules.vtkFiltersCore import vtkClipPolyData
from vtkmodules.vtkFiltersSources import vtkSphereSource
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa
from vtkmodules.vtkInteractionWidgets import (
    vtkImplicitPlaneRepresentation,
    vtkImplicitPlaneWidget2,
)
from vtkmodules.vtkIOXML import vtkXMLPolyDataReader
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkProperty,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)

from trame.widgets import client, html
from trame_vtklocal.widgets import vtklocal


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

    clipper = vtkClipPolyData(
        clip_function=plane, inside_out=1, input_connection=source.output_port
    )

    # Create a mapper and actor.
    mapper = vtkPolyDataMapper(input_connection=clipper.output_port)
    back_faces = vtkProperty(diffuse_color=colors.GetColor3d("Gold"))
    actor = vtkActor(mapper=mapper, backface_property=back_faces)

    # A renderer and render window
    renderer = vtkRenderer(background=colors.GetColor3d("SlateGray"))
    renderer.AddActor(actor)
    ren_win = vtkRenderWindow()
    ren_win.AddRenderer(renderer)

    # An interactor
    iren = vtkRenderWindowInteractor(
        render_window=ren_win, track_interactor_observer_instances=True
    )
    iren.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

    rep = vtkImplicitPlaneRepresentation(
        place_factor=1.25,
        outline_translation=False,
    )
    rep.PlaceWidget(input_bounds)
    rep.normal = plane.normal
    rep.origin = plane.origin

    plane_widget = vtkImplicitPlaneWidget2(interactor=iren)
    plane_widget.SetRepresentation(rep)

    renderer.ResetCamera(input_bounds)
    ren_win.Render()

    plane_widget.On()

    return ren_win, plane_widget, plane


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


class PlaneWidgetClipperApp(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)

        self.server.cli.add_argument("--data")
        args, _ = self.server.cli.parse_known_args()
        self.render_window, self.widget, self.plane = create_vtk_pipeline(args.data)

        # Allocation state variable for widget state
        self.state.plane_widget = None

        # Build UI
        self.html_view = None
        self._build_ui()

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
            widget_id = self.html_view.object_manager.GetId(self.widget)
            assert widget_id is not None and widget_id > 0
            self.state.wasm_listeners = {
                widget_id: {
                    "InteractionEvent": {
                        "plane_widget": {
                            "normal": (
                                widget_id,
                                "WidgetRepresentation",
                                "Normal",
                            ),
                            "origin": (
                                widget_id,
                                "WidgetRepresentation",
                                "Origin",
                            ),
                        }
                    }
                }
            }

    def one_time_update(self):
        widget_id = self.html_view.object_manager.GetId(self.widget)
        assert widget_id is not None and widget_id > 0
        self.html_view.eval(
            {
                "plane_widget": {
                    "origin": (widget_id, "WidgetRepresentation", "Origin"),
                    "normal": (widget_id, "WidgetRepresentation", "Normal"),
                }
            }
        )

    def _build_ui(self):
        with DivLayout(self.server) as self.ui:
            client.Style("body { margin: 0; }")
            html.Button(
                "Toggle listeners (currently {{ Object.keys(wasm_listeners).length === 0 ? 'Off' : 'On' }})",
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


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = PlaneWidgetClipperApp()
    app.server.start()
