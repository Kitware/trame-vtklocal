#!/usr/bin/env -S uv run --script
# /// script
#
# requires-python = ">=3.10"
#
# dependencies = [
#   "trame>=3.9",
#   "trame-vtklocal>=0.11",
#   "vtk==9.4.20250510.dev0",
# ]
#
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
#
# ///
from trame.app import TrameApp
from trame.ui.html import DivLayout
from trame.widgets import html, client
from trame_vtklocal.widgets import vtklocal

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

colors = vtkNamedColors()
NUMBER_OF_SPHERES = 10


class ActorPicker(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)

        # ---------------------------------------------------------------------
        # VTK setup
        # ---------------------------------------------------------------------
        renderer = vtkRenderer()
        renderer.SetBackground(colors.GetColor3d("SteelBlue"))

        renwin = vtkRenderWindow()
        renwin.AddRenderer(renderer)

        # An interactor
        interactor = vtkRenderWindowInteractor()
        interactor.SetRenderWindow(renwin)

        # add the custom style
        style = vtkInteractorStyleTrackballCamera()
        style.SetDefaultRenderer(renderer)
        interactor.SetInteractorStyle(style)

        randomSequence = vtkMinimalStandardRandomSequence()
        # randomSequence.SetSeed(1043618065)
        # randomSequence.SetSeed(5170)
        randomSequence.SetSeed(8775070)
        # Add spheres to play with
        for i in range(NUMBER_OF_SPHERES):
            source = vtkSphereSource()

            # random position and radius
            x = randomSequence.GetRangeValue(-5.0, 5.0)
            randomSequence.Next()
            y = randomSequence.GetRangeValue(-5.0, 5.0)
            randomSequence.Next()
            z = randomSequence.GetRangeValue(-5.0, 5.0)
            randomSequence.Next()
            radius = randomSequence.GetRangeValue(0.5, 1.0)
            randomSequence.Next()

            source.SetRadius(radius)
            source.SetCenter(x, y, z)
            source.SetPhiResolution(11)
            source.SetThetaResolution(21)

            mapper = vtkPolyDataMapper()
            mapper.SetInputConnection(source.GetOutputPort())
            actor = vtkActor()
            actor.SetMapper(mapper)

            r = randomSequence.GetRangeValue(0.4, 1.0)
            randomSequence.Next()
            g = randomSequence.GetRangeValue(0.4, 1.0)
            randomSequence.Next()
            b = randomSequence.GetRangeValue(0.4, 1.0)
            randomSequence.Next()

            actor.GetProperty().SetDiffuseColor(r, g, b)
            actor.GetProperty().SetDiffuse(0.8)
            actor.GetProperty().SetSpecular(0.5)
            actor.GetProperty().SetSpecularColor(colors.GetColor3d("White"))
            actor.GetProperty().SetSpecularPower(30.0)

            renderer.AddActor(actor)

        renderer.ResetCamera()

        self.camera = renderer.GetActiveCamera()
        self.interactor = interactor
        self.style = style
        self.renderer = renderer
        self.render_window = renwin

        self.LastPickedActor = None
        self.LastPickedProperty = vtkProperty()
        self.picker = vtkPropPicker()

        self.picker_wasm_id = 0
        self.prop_wasm_id = 0
        self.client_initialized = False

        # ---------------------------------------------------------------------
        # Build UI
        # ---------------------------------------------------------------------
        self.state.setdefault("clicked_pos", None)
        with DivLayout(self.server) as self.ui:
            client.Style("body { margin: 0; }")
            with html.Div(
                style="position: absolute; left: 0; top: 0; width: 100vw; height: 100vh;"
            ):
                with vtklocal.LocalView(
                    self.render_window,
                    throttle_rate=20,
                    ctx_name="wasm_view",
                    updated=self.setup_js,
                ) as view:
                    self.interactor_wasm_id = view.get_wasm_id(self.interactor)
                    self.picker_wasm_id = view.register_vtk_object(self.picker)
                    self.prop_wasm_id = view.register_vtk_object(
                        self.LastPickedProperty
                    )
                    self.renderer_id = view.get_wasm_id(self.renderer)

            # Enable picking client side
            client.Script("""
let pickingInitialized = false;
let pickPending = false;
let lastActor = null;
async function pick(xyz, picker, renderwindow, renderer, prop) {
    if (pickPending) {
        return;
    }
    try {
        pickPending = true;
        const found = await picker.Pick(xyz, renderer);
        if (found) {
            if (lastActor) {
              (await lastActor.GetProperty()).DeepCopy(prop);
              lastActor = null;
            }
            lastActor = await picker.GetActor();
            const actorProp = await lastActor.GetProperty();
            await prop.DeepCopy(actorProp);
            await actorProp.SetColor(1, 0, 1);
            await actorProp.EdgeVisibilityOn();
        }
        await renderwindow.Render();
    } finally {
        pickPending = false;
    }
}
function setupJSPicking(refName, interactorId, pickerId, renderWindowId, rendererId, propId) {
    if (pickingInitialized) {
        return;
    }
    pickingInitialized = true;
    console.log("setupJSPicking");
    const getVtkObject = window.trame.refs[refName].getVtkObject;
    const interactor = getVtkObject(interactorId);
    const picker = getVtkObject(pickerId);
    const renderer = getVtkObject(rendererId);
    const renderWindow = getVtkObject(renderWindowId);
    const prop = getVtkObject(propId);

    interactor.observe("MouseMoveEvent", async () => {
          const pos = interactor.state.EventPosition;
          await pick([pos[0], pos[1], 0], picker, renderWindow, renderer, prop);
    });
}""")
            self.ctrl.js_init = client.JSEval(
                exec="""utils.get('setupJSPicking')(
  $event.ref,
  $event.interactor,
  $event.picker,
  $event.rw,
  $event.renderer,
  $event.prop
)""",
            ).exec

    def setup_js(self, **_):
        self.ctrl.js_init(
            {
                "ref": self.ctx.wasm_view.ref_name,
                "interactor": self.interactor_wasm_id,
                "picker": self.picker_wasm_id,
                "rw": self.ctx.wasm_view.get_wasm_id(self.render_window),
                "renderer": self.renderer_id,
                "prop": self.prop_wasm_id,
            }
        )


def main():
    app = ActorPicker()
    app.server.start()


if __name__ == "__main__":
    main()
