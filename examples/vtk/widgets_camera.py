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
from vtkmodules.vtkIOXML import vtkXMLPolyDataReader
from vtkmodules.vtkFiltersSources import vtkConeSource
from vtkmodules.vtkInteractionWidgets import vtkCameraOrientationWidget
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkRenderer,
)

WASM = True  # "USE_WASM" in os.environ


def create_vtk_pipeline(path):
    colors = vtkNamedColors()
    data_source = None

    if path is not None and Path(path).is_file():
        data_source = vtkXMLPolyDataReader()
        data_source.SetFileName(path)
    else:
        data_source = vtkConeSource()

    renderer = vtkRenderer()
    ren_win = vtkRenderWindow()
    interactor = vtkRenderWindowInteractor()

    mapper = vtkPolyDataMapper()
    mapper.SetInputConnection(data_source.GetOutputPort())

    actor = vtkActor()
    actor.GetProperty().SetColor(colors.GetColor3d("Beige"))
    actor.SetMapper(mapper)

    renderer.AddActor(actor)
    renderer.SetBackground(colors.GetColor3d("DimGray"))

    ren_win.AddRenderer(renderer)

    # Important: The interactor must be set prior to enabling the widget.
    interactor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()
    interactor.SetRenderWindow(ren_win)

    cam_orient_manipulator = vtkCameraOrientationWidget()
    # cam_orient_manipulator.AnimateOn()
    # cam_orient_manipulator.SetInteractor(interactor)
    cam_orient_manipulator.SetParentRenderer(renderer)
    # Enable the widget.
    cam_orient_manipulator.On()

    ren_win.Render()

    return ren_win


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


class App:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")

        # enable shared array buffer
        self.server.http_headers.shared_array_buffer = True

        self.server.cli.add_argument("--data")
        args, _ = self.server.cli.parse_known_args()
        self.render_window = create_vtk_pipeline(args.data)
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
