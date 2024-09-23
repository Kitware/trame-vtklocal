import os
import numpy as np
import pyvista as pv

from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtk as vtk_widgets
from trame_vtklocal.widgets import vtklocal

WASM = "USE_WASM" in os.environ

# -----------------------------------------------------------------------------


def setup_pyvista():
    mesh = pv.Wavelet()

    points = np.array(
        [
            [-8.64208925, -7.34294559, -9.13803458],
            [-8.25601497, -2.54814702, 0.93860914],
            [-0.30179377, -3.21555997, -4.19999019],
            [3.24099167, 2.05814768, 3.39041509],
            [4.39935227, 4.18804542, 8.96391132],
        ]
    )

    p = pv.Plotter()
    p.add_mesh(mesh.outline(), color="black")
    p.add_mesh_slice_spline(mesh, initial_points=points, n_handles=5)
    p.show_grid()
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
