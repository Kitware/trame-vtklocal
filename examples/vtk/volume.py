#!/usr/bin/env -S uv run --script
# /// script
#
# requires-python = ">=3.10"
#
# dependencies = [
#   "trame>=3.13",
#   "trame-vtklocal>=1.3",
#   "trame-vuetify>=3.2.5",
#   "trame-vtk>=2.11.16",
#   "vtk>=9.7",
# ]
#
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
#
# ///
import vtk

from trame.app import TrameApp
from trame.ui.vuetify3 import SinglePageLayout
from trame.widgets import vtklocal, vuetify3 as v3
from trame.widgets.vtk import VtkRemoteView


# MAPPER_TYPE = "FixedPoint"
MAPPER_TYPE = "Smart"
# MAPPER_TYPE = "GPU"
# MAPPER_TYPE = "RayCast"
MAPPERS = {
    "FixedPoint": vtk.vtkFixedPointVolumeRayCastMapper(),
    "Smart": vtk.vtkSmartVolumeMapper(),
    "GPU": vtk.vtkOpenGLGPUVolumeRayCastMapper(),
    "RayCast": vtk.vtkGPUVolumeRayCastMapper(),
}

# -----------------------------------------------------------------------------


def setup_vtk():
    ren = vtk.vtkRenderer()
    renWin = vtk.vtkRenderWindow()
    renWin.AddRenderer(ren)
    iren = vtk.vtkRenderWindowInteractor()
    iren.SetRenderWindow(renWin)
    iren.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

    source = vtk.vtkRTAnalyticSource()
    source.Update()
    mapper = MAPPERS[MAPPER_TYPE]
    mapper.SetInputConnection(source.GetOutputPort())
    actor = vtk.vtkVolume()
    actor.SetMapper(mapper)
    actor.GetProperty().SetScalarOpacityUnitDistance(10)
    ren.AddActor(actor)

    colorTransferFunction = vtk.vtkColorTransferFunction()
    colorTransferFunction.AddRGBPoint(0.0, 0.0, 0.0, 0.0)
    colorTransferFunction.AddRGBPoint(64.0, 1.0, 0.0, 0.0)
    colorTransferFunction.AddRGBPoint(128.0, 0.0, 0.0, 1.0)
    colorTransferFunction.AddRGBPoint(192.0, 0.0, 1.0, 0.0)
    colorTransferFunction.AddRGBPoint(255.0, 0.0, 0.2, 0.0)

    opacityTransferFunction = vtk.vtkPiecewiseFunction()
    opacityTransferFunction.AddPoint(20, 0.0)
    opacityTransferFunction.AddPoint(255, 0.2)

    volumeProperty = vtk.vtkVolumeProperty()
    volumeProperty.SetColor(colorTransferFunction)
    volumeProperty.SetScalarOpacity(opacityTransferFunction)
    volumeProperty.ShadeOn()
    volumeProperty.SetInterpolationTypeToLinear()

    actor.SetProperty(volumeProperty)

    cube = vtk.vtkCubeAxesActor()
    cube.SetCamera(ren.GetActiveCamera())
    cube.SetBounds(source.GetOutput().GetBounds())
    ren.AddActor(cube)

    iren.Initialize()
    ren.ResetCamera()
    ren.SetBackground(0.7, 0.7, 0.7)
    renWin.Render()

    return renWin


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


class VolumeApp(TrameApp):
    def __init__(self, server=None):
        super().__init__(server, client_type="vue3")

        self.local_view = None
        self.render_window = setup_vtk()
        self._build_ui()

    def _build_ui(self):
        with SinglePageLayout(self.server) as self.ui:
            self.ui.title.set_text(
                "Volume rendering: click update to copy camera from VtkRemoteView (right) to WASM (left)"
            )
            self.ui.icon.click = self.ctrl.view_reset_camera

            with self.ui.toolbar:
                v3.VSpacer()
                v3.VBtn("Update", click=self.ctrl.view_update)

            with self.ui.content:
                with v3.VContainer(
                    fluid=True,
                    classes="pa-0 fill-height",
                ):
                    with v3.VContainer(
                        fluid=True, classes="pa-0 fill-height", style="width: 50%;"
                    ):
                        self.local_view = vtklocal.LocalView(self.render_window)
                        self.ctrl.view_update = self.local_view.update
                    with v3.VContainer(
                        fluid=True, classes="pa-0 fill-height", style="width: 50%;"
                    ):
                        VtkRemoteView(self.render_window, interactive_ratio=1)

            # hide footer
            self.ui.footer.hide()


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = VolumeApp()
    app.server.start()
