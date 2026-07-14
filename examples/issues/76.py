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


import vtkmodules.vtkRenderingOpenGL2  # noqa: F401
from trame.app import TrameApp
from trame.ui.vuetify3 import VAppLayout
from trame.widgets import vuetify3 as v3
from trame_vtklocal.widgets import vtklocal
from vtkmodules.vtkFiltersSources import vtkSphereSource
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa: F401
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkDataSetMapper,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)


def create_render_window():
    renderer = vtkRenderer()
    render_window = vtkRenderWindow()
    interactor = vtkRenderWindowInteractor(render_window=render_window)
    render_window.AddRenderer(renderer)
    interactor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()  # type: ignore[attr-defined]
    mapper = vtkDataSetMapper()
    actor = vtkActor(mapper=mapper)
    sphere = vtkSphereSource()
    sphere >> mapper
    renderer.AddActor(actor)

    return render_window


class MultiView(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)
        self._build_ui()

    def _build_ui(self):
        with VAppLayout(self.server, full_height=True) as self.ui:
            with v3.VRow(classes="h-100", no_gutters=True):
                for _ in range(2):
                    with v3.VCol():
                        vtklocal.LocalView(
                            create_render_window(),
                            config=(
                                "config",
                                {
                                    "rendering": "webgl",
                                    "exec": "async",
                                },
                            ),
                        )


def main():
    app = MultiView()
    app.server.start()


if __name__ == "__main__":
    main()
