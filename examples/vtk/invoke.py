from trame.app import get_server, asynchronous
from trame.ui.html import DivLayout
from trame.widgets import html, client
from trame_vtklocal.widgets import vtklocal
from trame.decorators import TrameApp, change

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

CLIENT_TYPE = "vue3"

# -----------------------------------------------------------------------------
# VTK pipeline
# -----------------------------------------------------------------------------


def create_vtk_pipeline():
    renderer = vtkRenderer()
    renderWindow = vtkRenderWindow()
    renderWindow.AddRenderer(renderer)

    renderWindowInteractor = vtkRenderWindowInteractor()
    renderWindowInteractor.SetRenderWindow(renderWindow)
    renderWindowInteractor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

    cone = vtkConeSource()

    mapper = vtkPolyDataMapper()
    mapper.SetInputConnection(cone.GetOutputPort())

    actor = vtkActor()
    actor.SetMapper(mapper)

    renderer.AddActor(actor)
    renderer.SetBackground(0.1, 0.2, 0.4)
    renderer.ResetCamera()

    return renderWindow, renderer, cone


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


@TrameApp()
class DemoApp:
    def __init__(self, server=None):
        self.server = get_server(server, client_type=CLIENT_TYPE)

        self.render_window, self.renderer, self.cone = create_vtk_pipeline()
        self.server.state.update(dict(mem_blob=0, mem_vtk=0))
        self.html_view = None
        self.ui = self._ui()
        # print(self.ui)

    def reset_camera(self):
        self.html_view.reset_camera()

    @change("resolution")
    def on_resolution_change(self, resolution, **kwargs):
        self.cone.SetResolution(int(resolution))
        self.html_view.update_throttle()

    def get_camera(self):
        print("call get_camera")
        asynchronous.create_task(self._get_client_camera())

    def debug(self):
        self.html_view.print_scene_manager_information()

    async def _get_client_camera(self):
        active_camera = await self.html_view.invoke(
            self.renderer, "GetActiveCamera", unwrap_vtk_object=False
        )
        print(f"\n{active_camera=}")

        cam_pos = await self.html_view.invoke(
            self.renderer.GetActiveCamera(), "GetPosition"
        )
        print(f"\n{cam_pos=}")

        # Making sure we got the same camera object on the server
        assert (
            self.html_view.get_vtk_obj(active_camera.get("Id"))
            == self.renderer.active_camera
        )

    def _ui(self):
        with DivLayout(self.server) as layout:
            client.Style("body { margin: 0; }")
            with html.Div(
                style="position: absolute; left: 0; top: 0; width: 100vw; height: 100vh;"
            ):
                self.html_view = vtklocal.LocalView(
                    self.render_window,
                    throttle_rate=20,
                    cache_size=("cache", 0),
                    memory_vtk="mem_vtk = $event",
                    memory_arrays="mem_blob = $event",
                )
            html.Div(
                "Scene: {{ (mem_vtk / 1024).toFixed(1) }}KB - "
                "Arrays: {{ (mem_blob / 1024).toFixed(1) }}KB - "
                "cache: {{ (cache/1024).toFixed(1) }}KB ",
                style=(
                    "position: absolute; top: 1rem; left: 1rem;"
                    "z-index: 10; background: white;"
                    "padding: 1rem; border-radius: 1rem;"
                ),
            )
            html.Input(
                type="range",
                v_model=("resolution", 6),
                min=3,
                max=60,
                step=1,
                style="position: absolute; top: 1rem; right: 1rem; z-index: 10;",
            )
            with html.Div(
                style="position: absolute; top: 3rem; right: 1rem; z-index: 10;"
            ):
                html.Button(
                    "Reset Camera",
                    click=self.reset_camera,
                )
                html.Button(
                    "Get Client Camera",
                    click=self.get_camera,
                )
                html.Button(
                    "Debug",
                    click=self.debug,
                )

        return layout


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = DemoApp()
    app.server.start()
