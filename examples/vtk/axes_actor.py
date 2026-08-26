#!/usr/bin/env -S uv run --script
# /// script
#
# requires-python = ">=3.10"
#
# dependencies = [
#   "trame>=3.13",
#   "trame-vtklocal>=1.3",
#   "trame-vuetify",
#   "vtk>=9.7",
# ]
#
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
#
# ///
from trame.app import TrameApp
from trame.ui.vuetify3 import SinglePageLayout
from trame.widgets import vtklocal, vuetify3 as v3

from vtkmodules.vtkFiltersSources import vtkConeSource
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)
from vtkmodules.vtkRenderingAnnotation import vtkAxesActor
from vtkmodules.vtkCommonTransforms import vtkTransform

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa


class AxesApp(TrameApp):
    def __init__(self, server=None):
        super().__init__(server, client_type="vue3")
        self._setup_vtk()
        self._build_ui()

    def _setup_vtk(self):
        renderer = vtkRenderer()
        renderWindow = vtkRenderWindow()
        renderWindow.AddRenderer(renderer)

        renderWindowInteractor = vtkRenderWindowInteractor()
        renderWindowInteractor.SetRenderWindow(renderWindow)
        renderWindowInteractor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

        cone_source = vtkConeSource()
        mapper = vtkPolyDataMapper()
        mapper.SetInputConnection(cone_source.GetOutputPort())
        actor = vtkActor()
        actor.SetMapper(mapper)
        axes = vtkAxesActor()
        # axes.SetShaftTypeToCylinder()
        axes.SetShaftTypeToLine()
        transform = vtkTransform()
        transform.Translate(1.0, 0.0, 0.0)
        axes.SetUserTransform(transform)
        renderer.AddActor(axes)

        renderer.AddActor(actor)
        renderer.ResetCamera()

        self.render_window = renderWindow

    def _build_ui(self):
        with SinglePageLayout(self.server) as self.ui:
            self.ui.title.set_text("Hello trame-vtklocal")

            with self.ui.content:
                with v3.VContainer(
                    fluid=True,
                    classes="pa-0 h-100",
                ):
                    vtklocal.LocalView(self.render_window)


if __name__ == "__main__":
    app = AxesApp()
    app.server.start()
