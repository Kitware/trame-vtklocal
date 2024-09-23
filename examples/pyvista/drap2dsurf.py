# import os
import numpy as np
import pyvista as pv
from pyvista import examples

from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtk as vtk_widgets
from trame_vtklocal.widgets import vtklocal

WASM = True  # "USE_WASM" in os.environ

# -----------------------------------------------------------------------------


def setup_pyvista():
    path = examples.download_gpr_path().points
    data = examples.download_gpr_data_array()

    nsamples, ntraces = (
        data.shape
    )  # Might be opposite for your data, pay attention here
    z_spacing = 0.12
    points = np.repeat(path, nsamples, axis=0)
    tp = np.arange(0, z_spacing * nsamples, z_spacing)
    tp = path[:, 2][:, None] - tp
    points[:, -1] = tp.ravel()
    grid = pv.StructuredGrid()
    grid.points = points
    grid.dimensions = nsamples, ntraces, 1
    grid["values"] = data.ravel(order="F")
    # ---
    p = pv.Plotter()
    p.add_mesh(grid, cmap="seismic", clim=[-1, 1])
    p.add_mesh(pv.PolyData(path), color="orange")
    p.reset_camera()
    p.show_axes()
    widgets = [r.axes_widget for r in p.renderers if hasattr(r, "axes_widget")]

    return p.ren_win, widgets


# -----------------------------------------------------------------------------


class TrameApp:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")

        self.render_window, self.widgets = setup_pyvista()
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
                    for w in self.widgets:
                        self.html_view.register_widget(w)
                else:
                    self.html_view = vtk_widgets.VtkRemoteView(
                        self.render_window, interactive_ratio=1
                    )

        return layout


# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = TrameApp()
    app.server.start()
