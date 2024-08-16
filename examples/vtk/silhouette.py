from trame.app import get_server
from trame.decorators import TrameApp, change
from trame.ui.vuetify3 import SinglePageLayout
from trame.widgets import vtk as vtk_widgets, vuetify3
from trame_vtklocal.widgets import vtklocal
from vtkmodules.vtkFiltersHybrid import vtkPolyDataSilhouette
from vtkmodules.vtkFiltersSources import vtkConeSource

from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa


def setup_vtk():
    renderer = vtkRenderer()
    renderWindow = vtkRenderWindow()
    renderWindow.AddRenderer(renderer)

    renderWindowInteractor = vtkRenderWindowInteractor()
    renderWindowInteractor.SetRenderWindow(renderWindow)
    renderWindowInteractor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

    cone_source = vtkConeSource()
    mapper = vtkPolyDataMapper()
    actor = vtkActor()
    mapper.SetInputConnection(cone_source.GetOutputPort())
    actor.SetMapper(mapper)
    renderer.AddActor(actor)

    sil = vtkPolyDataSilhouette()
    sil.SetInputConnection(cone_source.GetOutputPort())
    sil.SetCamera(renderer.GetActiveCamera())
    silmapper = vtkPolyDataMapper()
    silmapper.SetInputConnection(sil.GetOutputPort())
    silactor = vtkActor()
    silactor.GetProperty().SetColor(1, 0, 0)
    silactor.GetProperty().SetLineWidth(10)
    silactor.SetMapper(silmapper)
    renderer.AddActor(silactor)

    renderer.ResetCamera()
    renderWindow.Render()

    return renderWindow, cone_source


@TrameApp()
class SilhouetteApp:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")

        # enable shared array buffer
        self.server.http_headers.shared_array_buffer = True

        self.render_window, self.cone_source = setup_vtk()
        self.ui = self._build_ui()

    @property
    def ctrl(self):
        return self.server.controller

    @property
    def state(self):
        return self.server.state

    @change("resolution")
    def on_resolution(self, resolution, **kwargs):
        self.cone_source.SetResolution(resolution)
        self.ctrl.view2_update()
        self.ctrl.view_update()

    def reset_resolution(self):
        self.state.resolution = 6

    def _build_ui(self):
        with SinglePageLayout(self.server) as layout:
            layout.icon.click = self.ctrl.view_reset_camera
            layout.title.set_text("Cone Application")

            with layout.toolbar:
                vuetify3.VSpacer()
                vuetify3.VSlider(
                    v_model=("resolution", 6),
                    min=3,
                    max=60,
                    step=1,
                    hide_details=True,
                    density="compact",
                    style="max-width: 300px",
                )
                vuetify3.VDivider(vertical=True, classes="mx-2")
                with vuetify3.VBtn(icon=True, click=self.reset_resolution):
                    vuetify3.VIcon("mdi-undo-variant")
                vuetify3.VBtn("Update view", click=self.ctrl.view_update)

            with layout.content:
                with vuetify3.VContainer(
                    fluid=True,
                    classes="pa-0 fill-height",
                ):
                    with vuetify3.VCol(classes="pa-0 fill-height"):
                        view = vtklocal.LocalView(
                            self.render_window,
                            eager_sync=True,
                        )
                        self.ctrl.view_update = view.update
                        self.ctrl.view_reset_camera = view.reset_camera
                    with vuetify3.VCol(classes="pa-0 fill-height"):
                        vr = vtk_widgets.VtkRemoteView(
                            self.render_window,
                            ref="remote",
                            interactive_ratio=1,
                        )
                        self.ctrl.view2_update = vr.update


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = SilhouetteApp()
    app.server.start()
