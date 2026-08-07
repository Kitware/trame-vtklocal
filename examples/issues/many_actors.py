#!/usr/bin/env -S uv run --script
#
# /// script
# requires-python = ">=3.12"
# dependencies = ["trame>3.13", "trame-vtklocal==1.0.2", "vtk==9.6.20260405.dev0", "trame-vuetify"]
#
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
#
# ///

import random

import vtkmodules.vtkRenderingOpenGL2  # noqa: F401
from trame.app import TrameApp
from trame.ui.vuetify3 import VAppLayout
from trame_vtklocal.widgets import vtklocal
from vtkmodules.vtkFiltersSources import vtkSphereSource
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa: F401
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)


def create_render_window(n_spheres=600):
    renderer = vtkRenderer()
    render_window = vtkRenderWindow()
    interactor = vtkRenderWindowInteractor(render_window=render_window)
    render_window.AddRenderer(renderer)
    interactor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()  # type: ignore[attr-defined]

    for _ in range(n_spheres):
        mapper = vtkPolyDataMapper()
        actor = vtkActor(mapper=mapper)
        sphere = vtkSphereSource(
            center=(
                random.random() * 10,
                random.random() * 10,
                random.random() * 10,
            ),
            radius=(0.1),
        )
        sphere >> mapper
        renderer.AddActor(actor)

    renderer.ResetCamera()

    return render_window


class ManyActors(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)
        self._build_ui()

    def _build_ui(self):
        with VAppLayout(self.server, full_height=True) as self.ui:
            vtklocal.LocalView(
                create_render_window(),
            )


def main():
    app = ManyActors()
    app.server.start()


if __name__ == "__main__":
    main()
