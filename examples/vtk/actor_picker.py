# /// script
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
#
# dependencies = [
#   "trame",
#   "trame-vtklocal",
#   "vtk==9.4.20250403.dev0",
# ]
# ///

# $> uv run ./actor_picker.py


from trame.app import get_server, asynchronous
from trame.ui.html import DivLayout
from trame.widgets import html, client
from trame_vtklocal.widgets import vtklocal
from trame.decorators import TrameApp, change

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


class MouseInteractorHighLightActor(vtkInteractorStyleTrackballCamera):
    def __init__(self, parent=None):
        self.AddObserver("LeftButtonPressEvent", self.leftButtonPressEvent)

        self.LastPickedActor = None
        self.LastPickedProperty = vtkProperty()

    def leftButtonPressEvent(self, obj, event):
        clickPos = self.GetInteractor().GetEventPosition()

        picker = vtkPropPicker()
        picker.Pick(clickPos[0], clickPos[1], 0, self.GetDefaultRenderer())

        # get the new
        self.NewPickedActor = picker.GetActor()

        # If something was selected
        if self.NewPickedActor:
            # If we picked something before, reset its property
            if self.LastPickedActor:
                self.LastPickedActor.GetProperty().DeepCopy(self.LastPickedProperty)

            # Save the property of the picked actor so that we can
            # restore it next time
            self.LastPickedProperty.DeepCopy(self.NewPickedActor.GetProperty())
            # Highlight the picked actor by changing its properties
            self.NewPickedActor.GetProperty().SetColor(colors.GetColor3d("Red"))
            self.NewPickedActor.GetProperty().SetDiffuse(1.0)
            self.NewPickedActor.GetProperty().SetSpecular(0.0)
            self.NewPickedActor.GetProperty().EdgeVisibilityOn()

            # save the last picked actor
            self.LastPickedActor = self.NewPickedActor

        self.OnLeftButtonDown()
        return


@TrameApp()
class ActorPicker:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")

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

        # ---------------------------------------------------------------------
        # Build UI
        # ---------------------------------------------------------------------
        self.server.state.setdefault("clicked_pos", None)
        with DivLayout(self.server) as self.ui:
            client.Style("body { margin: 0; }")
            with html.Div(
                style="position: absolute; left: 0; top: 0; width: 100vw; height: 100vh;"
            ):
                with vtklocal.LocalView(
                    self.render_window,
                    throttle_rate=20,
                    ctx_name="wasm_view",
                ) as view:
                    pass
                    wasm_interactor_id = view.get_wasm_id(self.interactor)
                    print(f"{wasm_interactor_id=}")
                    view.listeners = (
                        "wasm_listeners",
                        {
                            wasm_interactor_id: {
                                "LeftButtonPressEvent": {
                                    "clicked_pos": {
                                        "x": (wasm_interactor_id, "EventPosition", 0),
                                        "y": (wasm_interactor_id, "EventPosition", 1),
                                    },
                                },
                            },
                        },
                    )
                    # Add a picker on client side
                    # view.register_vtk_object(self.picker) # FIXME not serializable yet

    @property
    def ctx(self):
        return self.server.context

    @change("clicked_pos")
    def on_actor_clicked(self, clicked_pos, **_):
        if clicked_pos is None:
            return

        # Not working yet
        asynchronous.create_task(self._activate_actor(**clicked_pos))

    async def _activate_actor(self, x, y):
        await self.ctx.wasm_view.invoke(self.picker, "Pick", x, y, 0, self.renderer)
        actor_info = await self.ctx.wasm_view.invoke(self.picker, "GetActor")
        actor = self.ctx.wasm_view.get_vtk_obj(actor_info.get("Id"))

        if actor:
            actor_prop = actor.property

            # Restore previous state
            if self.LastPickedActor:
                self.LastPickedActor.GetProperty().DeepCopy(self.LastPickedProperty)

            # Save previous state
            self.LastPickedProperty.DeepCopy(actor_prop)

            # Highlight actor
            actor_prop.color = colors.GetColor3d("Red")
            actor_prop.diffuse = 1
            actor_prop.specular = 0
            actor_prop.EdgeVisibilityOn()

            # Save actor for later reset
            self.LastPickedActor = actor

            # Render
            self.ctx.wasm_view.update()


def main():
    app = ActorPicker()
    app.server.start()


if __name__ == "__main__":
    main()
