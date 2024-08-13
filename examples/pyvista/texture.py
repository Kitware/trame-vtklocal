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
    elevation = examples.download_crater_topo().warp_by_scalar()
    topo_map = examples.download_crater_imagery()
    topo_map = topo_map.flip_y()  # flip to align to our dataset

    bounds = (1818000, 1824500, 5645000, 5652500, 0, 3000)
    local = elevation.clip_box(bounds, invert=False)
    surrounding = elevation.clip_box(bounds, invert=True)
    local.texture_map_to_plane(use_bounds=True, inplace=True)

    p = pv.Plotter()
    p.add_mesh(local, texture=topo_map)
    p.add_mesh(surrounding, color="white")
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
