from trame.app import get_server
from trame.ui.vuetify3 import SinglePageLayout
from trame.widgets import vuetify3, vtk as vtk_widgets

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

from trame_vtklocal.widgets import vtklocal


def setup_vtk():
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

    return renderWindow


class App:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")
        self.render_window = setup_vtk()
        self.ui = self._build_ui()

    def _build_ui(self):
        with SinglePageLayout(self.server) as layout:
            layout.title.set_text("Hello trame")

            with layout.content:
                with vuetify3.VContainer(
                    fluid=True,
                    classes="pa-0 fill-height",
                ):
                    with vuetify3.VCol(classes="pa-0 ma-1 fill-height"):
                        vtklocal.LocalView(self.render_window)
                    with vuetify3.VCol(classes="pa-0 ma-1 fill-height"):
                        vtk_widgets.VtkRemoteView(
                            self.render_window, interactive_ratio=1
                        )


if __name__ == "__main__":
    app = App()
    app.server.start()
