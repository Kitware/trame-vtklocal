import numpy as np
import pyvista as pv

from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtk as vtk_widgets
from trame_vtklocal.widgets import vtklocal

WASM = True  # "USE_WASM" in os.environ

# -----------------------------------------------------------------------------


def setup_pyvista():
    theta = np.linspace(-1 * np.pi, 1 * np.pi, 100)
    z = np.linspace(2, -2, 100)
    r = z**2 + 1
    x = r * np.sin(theta)
    y = r * np.cos(theta)
    points = np.column_stack((x, y, z))

    spline = pv.Spline(points, 1000)

    def get_point_along_spline(distance):
        """Return the closest point on the spline given a length along the spline."""
        idx = np.argmin(np.abs(spline.point_data["arc_length"] - distance))
        return spline.points[idx]

    # distances along the spline we're interested in
    dists = [0, 4, 8, 11]

    # make labels
    labels = []
    label_points = []
    for dist in dists:
        point = get_point_along_spline(dist)
        labels.append(f"Dist {dist}: ({point[0]:.2f}, {point[1]:.2f}, {point[2]:.2f})")
        label_points.append(point)

    p = pv.Plotter()
    p.add_mesh(spline, scalars="arc_length", render_lines_as_tubes=True, line_width=10)
    labels = p.add_point_labels(
        label_points,
        labels,
        always_visible=True,
        point_size=20,
        render_points_as_spheres=True,
    )
    p.show_bounds()
    # p.show_axes() # FIXME
    p.camera_position = "xz"
    p.reset_camera()

    return p.ren_win


# -----------------------------------------------------------------------------


class TrameApp:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")

        self.render_window = setup_pyvista()
        self.html_view = None
        self.ui = self._ui()
        self.server.state.change("scale")(self.update_scale)

    def update_scale(self, scale, **_):
        print(scale)
        # self.text.SetTextScaleModeToViewport()
        # self.html_view.update()

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
                html.Input(
                    type="range",
                    min=0.5,
                    max=4,
                    step=0.1,
                    v_model=("scale", 1),
                    style="position: absolute; top: 10px; left: 10px; z-index: 100; width: calc(100vw - 20px);",
                )

        return layout


# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = TrameApp()
    app.server.start()
