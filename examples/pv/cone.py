import paraview.web.venv  # noqa

from paraview import simple

from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client
from trame_vtklocal.widgets import vtklocal
from trame.decorators import TrameApp, change


CLIENT_TYPE = "vue3"


@TrameApp()
class DemoApp:
    def __init__(self, server=None):
        self.server = get_server(server, client_type=CLIENT_TYPE)

        self.cone = simple.Cone()
        self.representation = simple.Show()
        self.view = simple.Render()
        self.render_window = self.view.GetRenderWindow()
        self.server.state.update(dict(mem_blob=0, mem_vtk=0))
        self.html_view = None
        self.ui = self._ui()
        # print(self.ui)

    @change("resolution")
    def on_resolution_change(self, resolution, **kwargs):
        if int(resolution) != 6:
            self.cone.Resolution = int(resolution)
            simple.Render()
            self.html_view.update()

    def _ui(self):
        with DivLayout(self.server) as layout:
            client.Style("body { margin: 0; }")
            with html.Div(
                style="position: absolute; left: 0; top: 0; width: 100vw; height: 100vh;"
            ):
                self.html_view = vtklocal.LocalView(
                    self.render_window,
                    cache_size=("cache", 0),
                    memory_vtk="mem_vtk = $event",
                    memory_arrays="mem_blob = $event",
                )
            html.Div(
                "Scene: {{ (mem_vtk / 1024).toFixed(1) }}KB - "
                "Arrays: {{ (mem_blob / 1024).toFixed(1) }}KB - "
                "cache: {{ (cache/1024).toFixed(1) }}KB ",
                style=(
                    "position: absolute; top: 1rem; left: 1rem; z-index: 10;"
                    "background: white; padding: 1rem; border-radius: 1rem;"
                ),
            )
            html.Input(
                type="range",
                v_model=("resolution", 6),
                min=3,
                max=60,
                step=1,
                style="position: absolute; top: 1rem; right: 1rem; z-index: 10;",
            )
            html.Input(
                type="range",
                v_model=("cache", 0),
                min=0,
                max=100000,
                step=1000,
                style="position: absolute; top: 1rem; right: 10rem; z-index: 10;",
            )

        return layout


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = DemoApp()
    app.server.start()
