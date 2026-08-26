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
import vtkmodules.vtkRenderingOpenGL2  # noqa
from trame.app import TrameApp
from trame.ui.html import DivLayout
from vtkmodules.vtkFiltersSources import vtkSphereSource
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa
from vtkmodules.vtkInteractionWidgets import vtkBorderRepresentation, vtkBorderWidget
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)

from trame.widgets import client, vtklocal


class BorderWidget(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)

        self._setup_vtk()
        self._build_ui()

    def _setup_vtk(self):
        ss = vtkSphereSource()
        mapper = vtkPolyDataMapper()
        mapper.SetInputConnection(ss.GetOutputPort())
        actor = vtkActor()
        actor.SetMapper(mapper)

        # A renderer and render window
        renderer = vtkRenderer()
        renderer.AddActor(actor)
        renderer.SetBackground(0.1, 0.2, 0.4)
        renwin = vtkRenderWindow(off_screen_rendering=True)
        renwin.AddRenderer(renderer)

        # An interactor
        interactor = vtkRenderWindowInteractor(track_interactor_observer_instances=True)
        interactor.SetRenderWindow(renwin)
        interactor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

        # widget
        rep = vtkBorderRepresentation()
        rep.SetShowBorderToOn()
        rep.SetBorderColor(1, 0, 0)
        rep.SetBorderThickness(15)

        widget = vtkBorderWidget()
        widget.SetInteractor(interactor)
        widget.SetRepresentation(rep)
        widget.SelectableOff()
        widget.On()
        renderer.ResetCamera()
        renwin.Render()

        self.render_window = renwin

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
    app = BorderWidget()
    app.server.start()
