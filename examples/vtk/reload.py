import time
import random

from trame.app import TrameApp
from trame.ui.html import DivLayout
from trame.widgets import html, client
from trame_vtklocal.widgets import vtklocal
from trame.decorators import change

from vtkmodules.vtkFiltersSources import vtkSphereSource, vtkConeSource
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

# -----------------------------------------------------------------------------
# VTK pipeline
# -----------------------------------------------------------------------------

NB_SPHERE = 500
RESOLUTION = 80
SPACE = 20


def create_cone_pipeline():
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
    renderer.SetBackground(0.4, 0.2, 0.1)
    renderer.ResetCamera()

    return renderWindow, cone


def create_sphere_pipeline():
    renderer = vtkRenderer()
    renderWindow = vtkRenderWindow()
    renderWindow.AddRenderer(renderer)

    renderWindowInteractor = vtkRenderWindowInteractor()
    renderWindowInteractor.SetRenderWindow(renderWindow)
    renderWindowInteractor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

    for i in range(NB_SPHERE):
        center = [
            random.random() * SPACE,
            random.random() * SPACE,
            random.random() * SPACE,
        ]
        sphere = vtkSphereSource(
            phi_resolution=RESOLUTION, theta_resolution=RESOLUTION, center=center
        )
        mapper = vtkPolyDataMapper()
        sphere >> mapper
        actor = vtkActor(mapper=mapper)
        renderer.AddActor(actor)

    renderer.SetBackground(0.1, 0.2, 0.4)
    renderer.ResetCamera()

    return renderWindow


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


class DemoApp(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)
        self.spheres_rw = create_sphere_pipeline()
        self.cone_rw, self.cone = create_cone_pipeline()
        self.build_ui()
        self.time = 0

    @change("resolution")
    def update_resolution(self, resolution, **_):
        self.cone.resolution = int(resolution)
        self.ctx.cone_view.update_throttle()

    @change("reset_count")
    def reset_time(self, **_):
        self.time = time.time()

    def update_done(self):
        print(f"Update time {time.time() - self.time:0.2f}s")

    def build_ui(self):
        with DivLayout(self.server) as self.ui:
            client.Style("body { margin: 0; }")
            with html.Div(
                style="position: absolute; left: 0; top: 0; width: 50vw; height: 100vh;"
            ):
                vtklocal.LocalView(
                    self.spheres_rw,
                    shared_handler=True,
                    throttle_rate=20,
                    key=("reset_count", 0),
                    updated=self.update_done,
                )

            with html.Div(
                style="position: absolute; left: 50%; top: 0; width: 50vw; height: 100vh;"
            ):
                vtklocal.LocalView(
                    self.cone_rw,
                    shared_handler=True,
                    throttle_rate=20,
                    ctx_name="cone_view",
                )

            html.Button(
                "Reset",
                click="reset_count++",
                style="position: absolute; top: 1rem; left: 1rem; z-index: 10;",
            )

            html.Input(
                type="range",
                v_model=("resolution", 6),
                min=3,
                max=60,
                step=1,
                style="position: absolute; top: 1rem; right: 1rem; z-index: 10;",
            )


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = DemoApp()
    app.server.start()
