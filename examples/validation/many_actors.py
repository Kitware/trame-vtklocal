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

from trame.app import TrameApp
from trame.ui.html import DivLayout
from trame.widgets import client, vtklocal, html
from trame.decorators import change

import vtkmodules.vtkRenderingOpenGL2  # noqa: F401
from vtkmodules.vtkCommonColor import vtkNamedColors
from vtkmodules.vtkCommonCore import vtkMinimalStandardRandomSequence
from vtkmodules.vtkFiltersSources import vtkSphereSource
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleTrackballCamera
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkRenderer,
)

NUMBER_OF_SPHERES = 1_000
WORLD_RADIUS = 15
BACKGROUND = vtkNamedColors().GetColor3d("SteelBlue")


def actor_generator():
    randomSequence = vtkMinimalStandardRandomSequence()
    randomSequence.SetSeed(8775070)

    while True:
        # random position radius and color
        x = randomSequence.GetRangeValue(-WORLD_RADIUS, WORLD_RADIUS)
        y = randomSequence.GetNextRangeValue(-WORLD_RADIUS, WORLD_RADIUS)
        z = randomSequence.GetNextRangeValue(-WORLD_RADIUS, WORLD_RADIUS)
        radius = randomSequence.GetNextRangeValue(0.5, 1.0)
        r = randomSequence.GetNextRangeValue(0.4, 1.0)
        g = randomSequence.GetNextRangeValue(0.4, 1.0)
        b = randomSequence.GetNextRangeValue(0.4, 1.0)
        randomSequence.Next()

        source = vtkSphereSource(
            radius=radius,
            center=(x, y, z),
            phi_resolution=11,
            theta_resolution=21,
        )

        mapper = vtkPolyDataMapper()
        actor = vtkActor(mapper=mapper)
        source >> mapper

        actor.property.diffuse_color = (r, g, b)
        actor.property.diffuse = 0.8
        actor.property.specular = 0.5
        actor.property.specular_color = (1, 1, 1)
        actor.property.specular_power = 30

        yield actor


class ManyActors(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)

        # VTK setup
        renderer = vtkRenderer(background=BACKGROUND)
        renwin = vtkRenderWindow()
        renwin.AddRenderer(renderer)
        interactor = vtkRenderWindowInteractor(
            render_window=renwin,
            track_interactor_observer_instances=True,  # Remove the need to register widget + speed serialization
        )
        style = vtkInteractorStyleTrackballCamera()
        style.SetDefaultRenderer(renderer)
        interactor.SetInteractorStyle(style)

        actors = actor_generator()
        self.actors = []
        for _ in range(NUMBER_OF_SPHERES):
            new_actor = next(actors)
            self.actors.append(new_actor)
            renderer.AddActor(new_actor)

        renderer.ResetCamera()

        self.interactor = interactor
        self.renderer = renderer
        self.render_window = renwin

        # Build UI
        with DivLayout(self.server) as self.ui:
            self.ui.root.style = "height:100vh;"
            client.Style("body { margin: 0; }")
            vtklocal.LocalView(
                self.render_window,
                throttle_rate=20,
                ctx_name="wasm_view",
                config=["{rendering:'webgl'}"],  # webgpu, webgl
            )
            with html.Div(
                style="position:absolute;top:1rem;left:1rem;right:1rem;z-index:10;"
            ):
                html.Input(
                    type="range",
                    min=10,
                    step=10,
                    max=NUMBER_OF_SPHERES,
                    style="width:100%",
                    v_model_number=("visibility_count", NUMBER_OF_SPHERES),
                )

    @change("visibility_count")
    def _on_visibility(self, visibility_count, **_):
        for i, actor in enumerate(self.actors):
            if actor.visibility and i > visibility_count:
                actor.visibility = 0
            elif not actor.visibility and i < visibility_count:
                actor.visibility = 1

        self.ctx.wasm_view.update_throttle()


def main():
    app = ManyActors()
    app.server.start()


if __name__ == "__main__":
    main()
