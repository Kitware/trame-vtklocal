# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from trame.app import TrameApp
from trame.decorators import change
from trame.ui.html import DivLayout
from vtkmodules.vtkFiltersSources import vtkConeSource
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)

from trame.widgets import client, html
from trame_vtklocal.widgets import vtklocal

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

    return renderWindow, cone, actor


class DemoApp(TrameApp):
    def __init__(self, server=None):
        # dispose after unmount should only work with vue3
        super().__init__(server, client_type=CLIENT_TYPE)
        self.render_window, self.cone, self.actor = create_vtk_pipeline()
        self._build_ui()

    def reset_camera(self):
        self.ctx.view.reset_camera()

    @change("resolution")
    def on_resolution_change(self, resolution, **_):
        self.cone.SetResolution(int(resolution))
        self.ctx.view.update_throttle(
            resolution=resolution
        )  # provide custom content on update

    def _build_ui(self):
        with DivLayout(self.server) as self.ui:
            client.Style("body { margin: 0; }")
            with html.Div(
                style="position: absolute; left: 0; top: 0; width: 100vw; height: 100vh;",
                v_if=("mounted", True),
            ):
                self.html_view = vtklocal.LocalView(
                    self.render_window,
                    ctx_name="view",
                    throttle_rate=20,
                    config=("{ mode: 'wasm64' }",),
                    camera="console.log($event)",
                    updated="console.log('updated', $event)",  # print custom update content
                )
            with html.Div(
                style="""
                    position: absolute;
                    left: 1rem;
                    right: 1rem;
                    top: 1rem;
                    display: flex;
                    padding: 10px;
                    background: white;
                    gap: 15px;
                """
            ):
                html.Div("Resolution")
                html.Input(
                    type="range",
                    v_model=("resolution", 6),
                    min=3,
                    max=60,
                    step=1,
                )

                html.Div("Component mounted")
                html.Input(
                    type="checkbox",
                    v_model=("mounted", True),
                )
                html.Button("Dispose Runtime", click=self.ctx.view.dispose_wasm_runtime)
                html.Button(
                    "Dispose Session", click=self.ctx.view.dispose_remote_session
                )
                html.Button(
                    "Reset Camera",
                    click=self.reset_camera,
                )


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = DemoApp()
    app.server.start()
