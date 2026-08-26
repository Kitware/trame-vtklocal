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
from pathlib import Path

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from trame.app import TrameApp
from trame.ui.html import DivLayout
from vtkmodules.vtkCommonColor import vtkNamedColors
from vtkmodules.vtkFiltersSources import vtkConeSource
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa
from vtkmodules.vtkInteractionWidgets import vtkCameraOrientationWidget
from vtkmodules.vtkIOXML import vtkXMLPolyDataReader
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)

from trame.widgets import client, html, vtklocal


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
    interactor = vtkRenderWindowInteractor(track_interactor_observer_instances=True)

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
    cam_orient_manipulator.AnimateOn()
    cam_orient_manipulator.SetParentRenderer(renderer)
    # Enable the widget.
    cam_orient_manipulator.On()

    ren_win.Render()

    return ren_win


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


class CameraOrientationWidgetApp(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)
        self.server.cli.add_argument("--data")
        args, _ = self.server.cli.parse_known_args()
        self.render_window = create_vtk_pipeline(args.data)
        self.html_view = None
        self._build_ui()

    def _build_ui(self):
        with DivLayout(self.server) as self.ui:
            client.Style("body { margin: 0; }")
            with html.Div(
                style="position: absolute; left: 0; top: 0; width: 100vw; height: 100vh;"
            ):
                self.html_view = vtklocal.LocalView(self.render_window)


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = CameraOrientationWidgetApp()
    app.server.start()
