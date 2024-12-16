import vtk

from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtklocal

# Just for using this script in testing
from trame_client.utils.testing import enable_testing

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

    return rw, cone


class Cone:
    def __init__(self, server=None):
        self.server = enable_testing(get_server(server), "local_rendering_ready")
        self.render_window, self.cone = create_vtk_pipeline()
        self._build_ui()

    def _build_ui(self):
        self.server.state.local_rendering_ready = 0
        with DivLayout(self.server):
            html.Div("{{ local_rendering_ready }}", classes="readyCount")
            client.Style(
                "body { margin: 0; } .readyCount { z-index: 10; position: absolute; left: 0; top: 0; }"
            )
            with html.Div(style=FULL_SCREEN):
                vtklocal.LocalView(
                    self.render_window, updated="local_rendering_ready++"
                )


def main():
    app = Cone()
    app.server.start()


if __name__ == "__main__":
    main()
