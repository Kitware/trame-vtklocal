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

# ---------------------------------------------------------
# DOES NOT WORK YET
# ---------------------------------------------------------

from trame.app import TrameApp
from trame.ui.html import DivLayout
from trame.widgets import client, vtklocal

# noinspection PyUnresolvedReferences
from vtkmodules.vtkCommonColor import vtkNamedColors
from vtkmodules.vtkFiltersSources import vtkRegularPolygonSource, vtkSphereSource
from vtkmodules.vtkInteractionWidgets import vtkBalloonRepresentation, vtkBalloonWidget
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkRenderer,
)

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa


class BalloonWidgetApp(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)
        self._setup_vtk()
        self._build_ui()

    def _setup_vtk(self):
        colors = vtkNamedColors()

        # Sphere.
        sphere_source = vtkSphereSource()
        sphere_source.SetCenter(-4.0, 0.0, 0.0)
        sphere_source.SetRadius(4.0)

        sphere_mapper = vtkPolyDataMapper()
        sphere_mapper.SetInputConnection(sphere_source.GetOutputPort())

        sphereActor = vtkActor()
        sphereActor.SetMapper(sphere_mapper)
        sphereActor.GetProperty().SetColor(colors.GetColor3d("MistyRose"))

        # Regular Polygon.
        regular_polygon_source = vtkRegularPolygonSource()
        regular_polygon_source.SetCenter(4.0, 0.0, 0.0)
        regular_polygon_source.SetRadius(4.0)

        regular_polygon_mapper = vtkPolyDataMapper()
        regular_polygon_mapper.SetInputConnection(
            regular_polygon_source.GetOutputPort()
        )

        regularPolygonActor = vtkActor()
        regularPolygonActor.SetMapper(regular_polygon_mapper)
        regularPolygonActor.GetProperty().SetColor(colors.GetColor3d("Cornsilk"))

        # A renderer and render window.
        ren = vtkRenderer()
        ren_win = vtkRenderWindow()
        ren_win.AddRenderer(ren)
        ren_win.SetWindowName("BalloonWidget")

        # An interactor.
        iren = vtkRenderWindowInteractor(track_interactor_observer_instances=True)
        iren.SetRenderWindow(ren_win)

        # Create the widget.
        balloonRep = vtkBalloonRepresentation()
        balloonRep.SetBalloonLayoutToImageRight()

        balloonWidget = vtkBalloonWidget()
        balloonWidget.SetInteractor(iren)
        balloonWidget.SetRepresentation(balloonRep)
        balloonWidget.AddBalloon(sphereActor, "This is a sphere")
        balloonWidget.AddBalloon(regularPolygonActor, "This is a regular polygon")

        # Add the actors to the scene.
        ren.AddActor(sphereActor)
        ren.AddActor(regularPolygonActor)
        ren.SetBackground(colors.GetColor3d("SlateGray"))

        balloonWidget.On()

        self.render_window = ren_win
        self.widget = balloonWidget

    def _build_ui(self):
        with DivLayout(self.server) as self.ui:
            client.Style("body { margin: 0; }")
            self.ui.root.style = "height:100vh;"
            vtklocal.LocalView(
                self.render_window,
                throttle_rate=20,
                ctx_name="view",
            )


if __name__ == "__main__":
    print("FIXME: Ballon widget does not show in client")
    app = BalloonWidgetApp()
    app.server.start()
