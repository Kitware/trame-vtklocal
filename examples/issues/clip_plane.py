import math
import vtk

from trame.app import TrameApp
from trame.ui.vuetify3 import SinglePageLayout
from trame.widgets import vtklocal, html, vuetify3 as v3, vtk as vtkw
from trame.decorators import change

WASM = True


class App(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)
        self._setup_vtk()
        self._build_ui()

    def _setup_vtk(self):
        renderer = vtk.vtkRenderer()
        renderWindow = vtk.vtkRenderWindow()
        renderWindow.AddRenderer(renderer)

        renderWindowInteractor = vtk.vtkRenderWindowInteractor()
        renderWindowInteractor.SetRenderWindow(renderWindow)
        renderWindowInteractor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

        cone = vtk.vtkConeSource()
        sphere = vtk.vtkSphereSource()

        mapper = vtk.vtkPolyDataMapper()
        mapper.SetInputConnection(cone.GetOutputPort())

        mapper2 = vtk.vtkPolyDataMapper()
        mapper2.SetInputConnection(sphere.GetOutputPort())

        actor = vtk.vtkActor()
        actor.SetMapper(mapper)

        actor2 = vtk.vtkActor()
        actor2.SetMapper(mapper2)

        renderer.AddActor(actor)
        renderer.AddActor(actor2)
        renderer.SetBackground(0.1, 0.2, 0.4)
        renderer.ResetCamera()

        self.planes = [vtk.vtkPlane(), vtk.vtkPlane()]
        self.rw = renderWindow
        self.mappers = [mapper, mapper2]

    def _build_ui(self):
        with SinglePageLayout(self.server, full_height=True) as self.ui:
            with self.ui.toolbar:
                v3.VSpacer()
                with html.Div(classes="d-flex ga-6 mx-2"):
                    v3.VSwitch(
                        v_model=(
                            "activate_clip",
                            False,
                        ),  # if you start with true it kind of works
                        density="compact",
                        hide_details=True,
                    )
                    v3.VSlider(
                        v_model=("clip_angle", 0),
                        min=0,
                        max=360,
                        step=1,
                        hide_details=True,
                        density="compact",
                        style="width: 300px;",
                    )
                    v3.VRangeSlider(
                        v_model=("clip_radius", [-0.5, 0.5]),
                        min=-1,
                        max=1,
                        step=0.01,
                        hide_details=True,
                        density="compact",
                        style="width: 300px;",
                    )

            with self.ui.content:
                if WASM:
                    vtklocal.LocalView(self.rw, ctx_name="view")
                else:
                    vtkw.VtkRemoteView(self.rw, ctx_name="view")

    @change("activate_clip")
    def _on_activate(self, activate_clip, **_):
        for mapper in self.mappers:
            mapper.RemoveAllClippingPlanes()

            if activate_clip:
                mapper.AddClippingPlane(self.planes[0])
                mapper.AddClippingPlane(self.planes[1])

        self.ctx.view.update()

    @change("clip_angle", "clip_radius")
    def _on_change(self, clip_angle, clip_radius, **_):
        normal = [
            math.sin(math.radians(clip_angle)),
            math.cos(math.radians(clip_angle)),
            0,
        ]
        o1 = [
            normal[0] * clip_radius[0],
            normal[1] * clip_radius[0],
            normal[2] * clip_radius[0],
        ]
        o2 = [
            normal[0] * clip_radius[1],
            normal[1] * clip_radius[1],
            normal[2] * clip_radius[1],
        ]
        self.planes[0].normal = normal
        self.planes[0].origin = o1
        self.planes[1].normal = [-v for v in normal]
        self.planes[1].origin = o2

        self.ctx.view.update()


def main():
    app = App()
    app.server.start()


if __name__ == "__main__":
    main()
