from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client
from trame_vtklocal.widgets import vtklocal
from trame.decorators import TrameApp, change, trigger

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

    return renderWindow, cone


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


@TrameApp()
class DemoApp:
    def __init__(self, server=None):
        self.server = get_server(server, client_type=CLIENT_TYPE)
        self.render_window, self.cone = create_vtk_pipeline()
        self.server.state.update(dict(mem_blob=0, mem_vtk=0))
        self.html_view = None
        self.ui = self._ui()
        # print(self.ui)

    @trigger("export")
    def export(self, format):
        return self.html_view.export(format)

    def reset_camera(self):
        self.html_view.reset_camera()

    @change("resolution")
    def on_resolution_change(self, resolution, **kwargs):
        if int(resolution) != 6:
            self.cone.SetResolution(int(resolution))
            self.render_window.Render()
            self.html_view.update()

    def _ui(self):
        with DivLayout(self.server) as layout:
            client.Style("body { margin: 0; }")
            with html.Div(
                style="position: absolute; left: 0; top: 0; width: 100vw; height: 100vh;"
            ):
                self.html_view = vtklocal.LocalView(
                    self.render_window,
                    cache_size=("cache", 0),
                    memory_vtk="mem_vtk = $event",
                    memory_arrays="mem_blob = $event",
                )
            html.Div(
                "Scene: {{ (mem_vtk / 1024).toFixed(1) }}KB - Arrays: {{ (mem_blob / 1024).toFixed(1) }}KB - cache: {{ (cache/1024).toFixed(1) }}KB ",
                style="position: absolute; top: 1rem; left: 1rem; z-index: 10; background: white; padding: 1rem; border-radius: 1rem;",
            )
            html.Input(
                type="range",
                v_model=("resolution", 6),
                min=3,
                max=60,
                step=1,
                style="position: absolute; top: 1rem; right: 1rem; z-index: 10;",
            )
            html.Input(
                type="range",
                v_model=("cache", 0),
                min=0,
                max=100000,
                step=1000,
                style="position: absolute; top: 1rem; right: 10rem; z-index: 10;",
            )
            html.Button(
                "Export json",
                click="utils.download('scene-wasm.json', trigger('export', ['json']), 'application/octet-stream')",
                style="position: absolute; top: 3rem; right: 1rem; z-index: 10;",
            )
            html.Button(
                "Export zip",
                click="utils.download('scene-wasm.zip', trigger('export', ['zip']), 'application/octet-stream')",
                style="position: absolute; top: 3rem; right: 7rem; z-index: 10;",
            )
            html.Button(
                "Reset Camera",
                click=self.reset_camera,
                style="position: absolute; top: 3rem; right: 14rem; z-index: 10;",
            )

        return layout


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = DemoApp()
    app.server.start()
