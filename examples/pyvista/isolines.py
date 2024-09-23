# import os
import pyvista as pv
from pyvista import examples

from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtk as vtk_widgets
from trame_vtklocal.widgets import vtklocal

WASM = True  # "USE_WASM" in os.environ

# -----------------------------------------------------------------------------


def setup_pyvista():
    mesh = examples.load_random_hills()
    contours = mesh.contour()

    p = pv.Plotter()
    p.add_mesh(mesh, opacity=0.85)
    p.add_mesh(contours, color="white", line_width=5)
    p.reset_camera()
    # p.show_axes() # FIXME

    return p.ren_win


# -----------------------------------------------------------------------------


class TrameApp:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")

        self.render_window = setup_pyvista()
        self.html_view = None
        self.ui = self._ui()

    def _ui(self):
        with DivLayout(self.server) as layout:
            client.Style("body { margin: 0; }")
            with html.Div(
                style="position: absolute; left: 0; top: 0; width: 100vw; height: 100vh;"
            ):
                if WASM:
                    self.html_view = vtklocal.LocalView(self.render_window)
                else:
                    self.html_view = vtk_widgets.VtkRemoteView(
                        self.render_window, interactive_ratio=1
                    )

        return layout


# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = TrameApp()
    app.server.start()
