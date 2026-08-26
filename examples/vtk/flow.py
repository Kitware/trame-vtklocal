from pathlib import Path

from trame.app import TrameApp
from trame.ui.html import DivLayout
from trame.widgets import vtklocal, client

from vtkmodules.vtkCommonColor import vtkNamedColors
from vtkmodules.vtkCommonCore import vtkLookupTable
from vtkmodules.vtkFiltersCore import (
    vtkContourFilter,
    vtkGlyph3D,
    vtkMaskPoints,
    vtkThresholdPoints,
)
from vtkmodules.vtkFiltersModeling import vtkOutlineFilter
from vtkmodules.vtkFiltersSources import vtkConeSource
from vtkmodules.vtkIOLegacy import vtkStructuredPointsReader
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa

CLIENT_TYPE = "vue3"
DATA_FILE = str((Path(__file__).parent.with_name("data") / "carotid.vtk").resolve())

# -----------------------------------------------------------------------------
# VTK pipeline
# -----------------------------------------------------------------------------


def create_vtk_pipeline():
    renderer = vtkRenderer()
    renderWindow = vtkRenderWindow()
    renderWindow.AddRenderer(renderer)

    renderWindowInteractor = vtkRenderWindowInteractor()
    renderWindowInteractor.SetRenderWindow(renderWindow)
    renderWindowInteractor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

    # Read the data

    reader = vtkStructuredPointsReader()
    reader.SetFileName(DATA_FILE)

    # Glyphs

    threshold = vtkThresholdPoints()
    threshold.SetInputConnection(reader.GetOutputPort())
    threshold.upper_threshold = 200

    mask = vtkMaskPoints()
    mask.SetInputConnection(threshold.GetOutputPort())
    mask.SetOnRatio(5)

    cone = vtkConeSource()
    cone.SetResolution(11)
    cone.SetHeight(1)
    cone.SetRadius(0.25)

    cones = vtkGlyph3D()
    cones.SetInputConnection(mask.GetOutputPort())
    cones.SetSourceConnection(cone.GetOutputPort())
    cones.SetScaleFactor(0.4)
    cones.SetScaleModeToScaleByVector()

    lut = vtkLookupTable()
    lut.SetHueRange(0.667, 0.0)
    lut.Build()

    scalarRange = [0] * 2
    cones.Update()
    scalarRange[0] = cones.GetOutput().GetPointData().GetScalars().GetRange()[0]
    scalarRange[1] = cones.GetOutput().GetPointData().GetScalars().GetRange()[1]

    vectorMapper = vtkPolyDataMapper()
    vectorMapper.SetInputConnection(cones.GetOutputPort())
    vectorMapper.SetScalarRange(scalarRange[0], scalarRange[1])
    vectorMapper.SetLookupTable(lut)

    vectorActor = vtkActor()
    vectorActor.SetMapper(vectorMapper)

    # Contours

    iso = vtkContourFilter()
    iso.SetInputConnection(reader.GetOutputPort())
    iso.SetValue(0, 175)

    isoMapper = vtkPolyDataMapper()
    isoMapper.SetInputConnection(iso.GetOutputPort())
    isoMapper.ScalarVisibilityOff()

    isoActor = vtkActor()
    isoActor.SetMapper(isoMapper)
    isoActor.GetProperty().SetRepresentationToWireframe()
    # isoActor.GetProperty().SetLineWidth(2)
    isoActor.GetProperty().SetOpacity(0.75)

    # Outline

    colors = vtkNamedColors()

    outline = vtkOutlineFilter()
    outline.SetInputConnection(reader.GetOutputPort())

    outlineMapper = vtkPolyDataMapper()
    outlineMapper.SetInputConnection(outline.GetOutputPort())

    outlineActor = vtkActor()
    outlineActor.SetMapper(outlineMapper)
    outlineActor.GetProperty().SetColor(colors.GetColor3d("White"))

    # Add the actors to the renderer

    renderer.AddActor(outlineActor)
    renderer.AddActor(vectorActor)
    renderer.AddActor(isoActor)
    renderer.ResetCamera()
    renderWindow.Render()

    return renderWindow


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


class FlowApp(TrameApp):
    def __init__(self, server=None):
        super().__init__(server, client_type=CLIENT_TYPE)
        self.render_window = create_vtk_pipeline()
        self.ui = self._ui()

    def _ui(self):
        with DivLayout(self.server) as layout:
            layout.root.style = "width: 100vw; height: 100vh;"
            client.Style("body { margin: 0; }")
            vtklocal.LocalView(self.render_window)

        return layout


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = FlowApp()
    app.server.start()
