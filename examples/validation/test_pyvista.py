#!/usr/bin/env -S uv run --script
#
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "trame>=3.13.2",
#     "trame-vtklocal>=1.0.1",
#     "trame-vuetify",
#     "vtk==9.6.20260517.dev0",
#     "pyvista>=0.48.4",
# ]
#
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
# ///
from __future__ import annotations
import pyvista as pv
from pyvista import examples

from trame.app import TrameApp
from trame.ui.vuetify3 import VAppLayout
from trame.widgets import vuetify3 as v3
from trame.decorators import change

from trame_vtklocal.widgets import vtklocal

from vtkmodules.vtkFiltersCore import vtkContourFilter

pv.OFF_SCREEN = True


class ContourViewer(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)

        # PyVista viz setup
        volume = examples.download_head_2()
        data_range = tuple(volume.get_data_range())

        contour = vtkContourFilter(number_of_contours=1)
        contour.SetInputDataObject(volume)

        # Update trame state
        self.state.data_range = (float(data_range[0]), float(data_range[1]))
        self.state.contour_value = 0.5 * (data_range[0] + data_range[1])

        pl = pv.Plotter()
        pl.add_mesh(contour, cmap="viridis", clim=data_range)

        pl.camera.position = (-404.79988296140607, 472.3909763602064, 91.97414214495656)
        pl.camera.focal_point = (126.68265914916992, 123.96118450164795, 92.5)
        pl.camera.up = (0.20815009687634312, -0.178056364727541, -0.9617533301997878)
        pl.reset_camera(bounds=volume.bounds)

        # Keep some ref around
        self.contour = contour
        self.pl = pl

        # Build trame UI
        self._build_ui()

    @change("contour_value")
    def _on_contour(self, contour_value, **_):
        self.contour.SetValue(0, contour_value)
        self.ctx.view.update_throttle()

    def _build_ui(self):
        self.state.trame__title = "Contour"
        with VAppLayout(self.server) as self.ui:
            with v3.VMain():
                vtklocal.LocalView(self.pl.render_window, ctx_name="view")
            with v3.VFooter(app=True):
                v3.VProgressLinear(
                    indeterminate=True,
                    absolute=True,
                    bottom=True,
                    active=("trame__busy",),
                )
                v3.VSlider(
                    v_model="contour_value",
                    min=("data_range[0]",),
                    max=("data_range[1]",),
                    step=("(data_range[1] - data_range[0]) / 255",),
                    hide_details=True,
                    density="compact",
                )
                v3.VBtn(
                    icon="mdi-crop-free",
                    click=self.ctx.view.reset_camera,
                    classes="rounded",
                    flat=True,
                )


def main():
    app = ContourViewer()
    app.server.start()


if __name__ == "__main__":
    main()
