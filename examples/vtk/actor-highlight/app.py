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
from pathlib import Path

from trame.app import TrameApp
from trame.ui.html import DivLayout
from trame.widgets import client, vtklocal

import vtkmodules.vtkRenderingOpenGL2  # noqa: F401
from vtkmodules.vtkCommonColor import vtkNamedColors
from vtkmodules.vtkCommonCore import vtkMinimalStandardRandomSequence
from vtkmodules.vtkFiltersSources import vtkSphereSource
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleTrackballCamera
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkPropPicker,
    vtkProperty,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkRenderer,
)

NUMBER_OF_SPHERES = 10
BACKGROUND = vtkNamedColors().GetColor3d("SteelBlue")
JS_FILE = str(Path(__file__).with_name("pickHelper.js").resolve())


def load_js_file(server, js_file):
    js_file = Path(js_file).resolve()
    server.enable_module(
        {
            "serve": {
                "_local_app": str(js_file.parent),
            },
            "scripts": [f"_local_app/{js_file.name}"],
        }
    )


def actor_generator():
    randomSequence = vtkMinimalStandardRandomSequence()
    randomSequence.SetSeed(8775070)

    while True:
        # random position radius and color
        x = randomSequence.GetRangeValue(-5.0, 5.0)
        y = randomSequence.GetNextRangeValue(-5.0, 5.0)
        z = randomSequence.GetNextRangeValue(-5.0, 5.0)
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


class ActorPicker(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)
        load_js_file(self.server, JS_FILE)

        # VTK setup
        renderer = vtkRenderer(background=BACKGROUND)
        renwin = vtkRenderWindow()
        renwin.AddRenderer(renderer)
        interactor = vtkRenderWindowInteractor(render_window=renwin)
        style = vtkInteractorStyleTrackballCamera()
        style.SetDefaultRenderer(renderer)
        interactor.SetInteractorStyle(style)

        actors = actor_generator()
        for _ in range(NUMBER_OF_SPHERES):
            renderer.AddActor(next(actors))

        renderer.ResetCamera()

        self.interactor = interactor
        self.renderer = renderer
        self.render_window = renwin

        self.LastPickedProperty = vtkProperty()
        self.picker = vtkPropPicker()

        self.picker_wasm_id = 0
        self.prop_wasm_id = 0

        # Build UI
        with DivLayout(self.server) as self.ui:
            self.ui.root.style = "height:100vh;"
            client.Style("body { margin: 0; }")
            with vtklocal.LocalView(
                self.render_window,
                throttle_rate=20,
                ctx_name="wasm_view",
                updated=self.setup_js,
            ) as view:
                self.picker_wasm_id = view.register_vtk_object(self.picker)
                self.prop_wasm_id = view.register_vtk_object(self.LastPickedProperty)

            # Enable picking client side
            self.ctrl.js_init = client.JSEval(
                exec="window.setupJSPicking(...$event)"
            ).exec

    def setup_js(self):
        self.ctrl.js_init(
            [
                self.ctx.wasm_view.ref_name,
                self.ctx.wasm_view.get_wasm_id(self.interactor),
                self.picker_wasm_id,
                self.ctx.wasm_view.get_wasm_id(self.render_window),
                self.ctx.wasm_view.get_wasm_id(self.renderer),
                self.prop_wasm_id,
            ]
        )


def main():
    app = ActorPicker()
    app.server.start()


if __name__ == "__main__":
    main()
