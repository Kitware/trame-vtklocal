import vtk

from trame.app import get_server
from trame.ui.vuetify3 import SinglePageLayout
from trame.widgets import vuetify3 as vuetify
from trame.widgets.vtk import VtkRemoteView
from trame_vtklocal.widgets import vtklocal


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


class App:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")
        self.render_window = setup_vtk()
        self.ui = self._build_ui()

    @property
    def ctrl(self):
        return self.server.controller

    def _build_ui(self):
        with SinglePageLayout(self.server) as layout:
            layout.icon.click = self.ctrl.view_reset_camera

            with layout.content:
                with vuetify.VContainer(
                    fluid=True,
                    classes="pa-0 fill-height",
                ):
                    with vuetify.VContainer(
                        fluid=True, classes="pa-0 fill-height", style="width: 50%;"
                    ):
                        vtklocal.LocalView(self.render_window)
                    with vuetify.VContainer(
                        fluid=True, classes="pa-0 fill-height", style="width: 50%;"
                    ):
                        VtkRemoteView(self.render_window)

            # hide footer
            layout.footer.hide()


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = App()
    app.server.start()
