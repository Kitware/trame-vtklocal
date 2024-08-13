# import os
from pathlib import Path

from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtk as vtk_widgets
from trame_vtklocal.widgets import vtklocal

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa

from vtkmodules.vtkCommonColor import vtkNamedColors
from vtkmodules.vtkCommonCore import vtkCommand
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

WASM = True  # "USE_WASM" in os.environ


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
    print(input_bounds)

    plane_widget = vtkImplicitPlaneWidget2()
    plane_widget.SetInteractor(iren)
    plane_widget.SetRepresentation(rep)

    if not WASM:
        my_callback = IPWCallback(plane)
        plane_widget.AddObserver(vtkCommand.InteractionEvent, my_callback)

    renderer.ResetCamera(input_bounds)
    ren_win.Render()

    plane_widget.On()

    return ren_win, plane_widget


class IPWCallback:
    def __init__(self, plane):
        self.plane = plane

    def __call__(self, caller, ev):
        rep = caller.GetRepresentation()
        rep.GetPlane(self.plane)


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


class App:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")
        self.server.cli.add_argument("--data")
        args, _ = self.server.cli.parse_known_args()
        self.render_window, self.widget = create_vtk_pipeline(args.data)
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
