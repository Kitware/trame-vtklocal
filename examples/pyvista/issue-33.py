# import os
import pyvista as pv
from pyvista import examples

from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtk as vtk_widgets
from trame_vtklocal.widgets import vtklocal

WASM = True  # "USE_WASM" in os.environ
save_ok = False
save_ko = False

# -----------------------------------------------------------------------------
p = pv.Plotter()
p.ren_win.OffScreenRenderingOn()


def setup_pyvista():
    p.show_axes()
    widgets = [r.axes_widget for r in p.renderers if hasattr(r, "axes_widget")]
    # p.ren_win.OffScreenRenderingOn()

    return p.ren_win, widgets


# -----------------------------------------------------------------------------


class TrameApp:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")
        self.render_window, self.widgets = setup_pyvista()
        self.html_view = None
        self.ui = self._ui()
        if save_ok:
            self.add_mesh()
            self.html_view.update()
            self.html_view.save("/Users/sebastien.jourdain/Desktop/scene_ok.zip")

    def add_mesh(self):
        mesh = examples.download_st_helens()
        warped = mesh.warp_by_scalar("Elevation")
        surf = warped.extract_surface().triangulate()
        surf = surf.decimate_pro(0.75)  # reduce the density of the mesh by 75%
        p.add_mesh(surf, cmap="gist_earth")
        p.reset_camera()
        if self.html_view:
            self.html_view.update()
            if save_ko:
                self.html_view.save("/Users/sebastien.jourdain/Desktop/scene.zip")

    def _ui(self):
        with DivLayout(self.server) as layout:
            html.Button(
                "Add Mesh",
                click=self.add_mesh,
                style={"position": "absolute", "z-index": 999},
            )
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
