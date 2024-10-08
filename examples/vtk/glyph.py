from trame.app import get_server
from trame.ui.vuetify3 import SinglePageLayout
from trame.widgets import vuetify3 as vuetify
from trame.widgets.vtk import VtkRemoteView
from trame_vtklocal.widgets import vtklocal
from trame.decorators import TrameApp, change

from vtkmodules.vtkCommonColor import vtkNamedColors
from vtkmodules.vtkFiltersCore import vtkElevationFilter, vtkGlyph3D
from vtkmodules.vtkFiltersSources import vtkConeSource, vtkCubeSource, vtkSphereSource
from vtkmodules.vtkImagingCore import vtkRTAnalyticSource
from vtkmodules.vtkImagingGeneral import vtkImageGradient
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkRenderer,
)

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa

import json


def setup_vtk():
    colors = vtkNamedColors()

    # The Wavelet Source is nice for generating a test vtkImageData set
    rt = vtkRTAnalyticSource()
    rt.SetWholeExtent(-2, 2, -2, 2, 0, 0)

    # Take the gradient of the only scalar 'RTData' to get a vector attribute
    grad = vtkImageGradient()
    grad.SetDimensionality(3)
    grad.SetInputConnection(rt.GetOutputPort())

    # Elevation just to generate another scalar attribute that varies nicely over the data range
    elev = vtkElevationFilter()
    # Elevation values will range from 0 to 1 between the Low and High Points
    elev.SetLowPoint(-2, -2, 0)
    elev.SetHighPoint(2, 2, 0)
    elev.SetInputConnection(grad.GetOutputPort())

    # Create simple PolyData for glyph table
    cs = vtkCubeSource()
    cs.SetXLength(0.5)
    cs.SetYLength(1)
    cs.SetZLength(2)
    ss = vtkSphereSource()
    ss.SetRadius(0.25)
    cs2 = vtkConeSource()
    cs2.SetRadius(0.25)
    cs2.SetHeight(0.5)

    # Set up the glyph filter
    glyph = vtkGlyph3D()
    glyph.SetInputConnection(elev.GetOutputPort())

    # Here is where we build the glyph table
    # that will be indexed into according to the IndexMode
    glyph.SetSourceConnection(0, cs.GetOutputPort())
    glyph.SetSourceConnection(1, ss.GetOutputPort())
    glyph.SetSourceConnection(2, cs2.GetOutputPort())

    glyph.ScalingOn()
    glyph.SetScaleModeToScaleByScalar()
    glyph.SetVectorModeToUseVector()
    glyph.OrientOn()
    glyph.SetScaleFactor(1)  # Overall scaling factor
    glyph.SetRange(0, 1)  # Default is (0,1)

    # Tell it to index into the glyph table according to scalars
    glyph.SetIndexModeToScalar()

    # Tell glyph which attribute arrays to use for what
    glyph.SetInputArrayToProcess(0, 0, 0, 0, "Elevation")  # scalars
    glyph.SetInputArrayToProcess(1, 0, 0, 0, "RTDataGradient")  # vectors

    coloring_by = "Elevation"
    mapper = vtkPolyDataMapper()
    mapper.SetInputConnection(glyph.GetOutputPort())
    mapper.SetScalarModeToUsePointFieldData()
    mapper.SetColorModeToMapScalars()
    mapper.ScalarVisibilityOn()

    # GetRange() call doesn't work because attributes weren't copied to glyphs
    # as they should have been...
    # mapper.SetScalarRange(glyph.GetOutputDataObject(0).GetPointData().GetArray(coloring_by).GetRange())

    mapper.SelectColorArray(coloring_by)
    actor = vtkActor()
    actor.SetMapper(mapper)

    ren = vtkRenderer()
    ren.AddActor(actor)
    ren.SetBackground(colors.GetColor3d("DarkGray"))

    renWin = vtkRenderWindow()
    renWin.AddRenderer(ren)

    renderWindowInteractor = vtkRenderWindowInteractor()
    renderWindowInteractor.SetRenderWindow(renWin)
    renderWindowInteractor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

    ren.ResetCamera()

    return renWin, ren, cs2, ss


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


@TrameApp()
class App:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")

        self.render_window, self.renderer, self.cone, self.sphere = setup_vtk()
        self.view_local = None
        self.view_remote = None
        self.ui = self._build_ui()

        self.server.state.camera = None

    @property
    def ctrl(self):
        return self.server.controller

    @change("resolution")
    def on_resolution_change(self, resolution, **kwargs):
        self.cone.SetResolution(int(resolution))
        self.sphere.SetStartTheta(int(resolution) * 6)
        self.view_remote.update()
        self.view_local.update()

    @change("camera")
    def on_camera_change(self, camera, **kwargs):
        if camera is not None:
            self.view_local.object_manager.UpdateObjectFromState(json.dumps(camera))
            self.view_remote.update()

    def reset_camera(self):
        self.renderer.ResetCamera()
        self.view_local.update()
        self.view_remote.update()

    def update_client(self, reset_camera=False):
        if reset_camera:
            self.renderer.ResetCamera()
            self.ctrl.rview_reset_camera()
        self.ctrl.view_update(push_camera=True)

    def _build_ui(self):
        with SinglePageLayout(self.server) as layout:
            layout.icon.click = self.reset_camera
            with layout.toolbar:
                vuetify.VSpacer()
                vuetify.VSlider(
                    v_model=("resolution", 6),
                    min=3,
                    max=60,
                    step=1,
                    dense=True,
                    hide_details=True,
                )
                vuetify.VBtn("S => C", click=self.update_client)
                vuetify.VBtn(icon="mdi-crop-free", click=self.ctrl.view_reset_camera)
                vuetify.VBtn(
                    icon="mdi-panorama-variant-outline",
                    click=(self.update_client, "[true]"),
                )

            with layout.content:
                with vuetify.VContainer(
                    fluid=True,
                    classes="pa-0 fill-height",
                ):
                    with vuetify.VContainer(
                        fluid=True, classes="pa-0 fill-height", style="width: 50%;"
                    ):
                        self.view_local = vtklocal.LocalView(
                            self.render_window,
                            eager_sync=True,
                            camera="camera = $event",
                        )
                        self.ctrl.view_update = self.view_local.update
                        self.ctrl.view_reset_camera = self.view_local.reset_camera
                    with vuetify.VContainer(
                        fluid=True, classes="pa-0 fill-height", style="width: 50%;"
                    ):
                        self.view_remote = VtkRemoteView(
                            self.render_window, interactive_ratio=1
                        )
                        self.ctrl.rview_reset_camera = self.view_remote.reset_camera

            # hide footer
            layout.footer.hide()


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = App()
    app.server.start()
