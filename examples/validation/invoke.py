import vtk

from trame.app import TrameApp, asynchronous
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtklocal

# Just for using this script in testing

FULL_SCREEN = "position:absolute; left:0; top:0; width:100vw; height:100vh;"


def create_vtk_pipeline():
    renderer = vtk.vtkRenderer()
    rw = vtk.vtkRenderWindow()
    rw.AddRenderer(renderer)
    rwi = vtk.vtkRenderWindowInteractor(render_window=rw)
    rwi.interactor_style.SetCurrentStyleToTrackballCamera()

    cone = vtk.vtkConeSource()

    mapper = vtk.vtkPolyDataMapper(input_connection=cone.output_port)
    actor = vtk.vtkActor(mapper=mapper)

    renderer.AddActor(actor)
    renderer.background = (0.1, 0.2, 0.4)
    renderer.ResetCamera()

    return rw, cone, actor.property


class Cone(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)
        self.render_window, self.cone, self.property = create_vtk_pipeline()
        print(self.property.opacity)
        self._build_ui()

    @asynchronous.task
    async def invokes(self, value):
        # await asyncio.sleep(0.1)
        before = await self.ctx.view.invoke(self.property, "GetColor")
        print(f"before ({value})", before)
        # await asyncio.sleep(0.5)
        set_reponse = await self.ctx.view.invoke(self.property, "SetColor", value)
        print(f"set rep ({value})", set_reponse)
        self.ctx.view.render()

    def _build_ui(self):
        self.server.state.local_rendering_ready = 0
        with DivLayout(self.server):
            with html.Div(classes="overlay"):
                html.Button("Red", click=(self.invokes, "[[1,0,0]]"))
                html.Button("Green", click=(self.invokes, "[[0,1,0]]"))
                html.Button("Blue", click=(self.invokes, "[[0,0,1]]"))

            client.Style(
                "body { margin: 0; } .overlay { z-index: 10; position: absolute; left: 1rem; top: 1rem; }"
            )
            with html.Div(style=FULL_SCREEN):
                vtklocal.LocalView(
                    self.render_window,
                    ctx_name="view",
                )
                self.ctx.view.register_vtk_object(self.cone)


def main():
    app = Cone()
    app.server.start()


if __name__ == "__main__":
    main()
