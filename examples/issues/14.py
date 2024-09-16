from trame.app import get_server
from trame.ui.vuetify3 import SinglePageLayout
from trame.widgets import vuetify3, vtklocal

from vtkmodules.vtkCommonColor import vtkNamedColors
from vtkmodules.vtkFiltersCore import vtkTriangleFilter
from vtkmodules.vtkFiltersSources import vtkPlaneSource
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkRenderer,
    vtkTextActor,
)


USE_WASM = True


def create_text_actor(myText):
    colors = vtkNamedColors()
    txt = vtkTextActor()
    txt.SetInput(myText)
    txtprop = txt.GetTextProperty()
    txtprop.SetFontFamilyToArial()
    txtprop.BoldOn()
    txtprop.SetFontSize(36)
    txtprop.ShadowOn()
    txtprop.SetShadowOffset(4, 4)
    txtprop.SetColor(colors.GetColor3d("Cornsilk"))
    txt.SetDisplayPosition(20, 30)
    return txt


def setup_vtk():

    colors = vtkNamedColors()

    plane_source = vtkPlaneSource()
    plane_source.Update()

    triangle_filter = vtkTriangleFilter()
    triangle_filter.SetInputConnection(plane_source.GetOutputPort())
    triangle_filter.Update()

    mapper = vtkPolyDataMapper()
    mapper.SetInputConnection(triangle_filter.GetOutputPort())

    actor = vtkActor()
    actor.GetProperty().SetColor(colors.GetColor3d("SeaGreen"))
    actor.SetMapper(mapper)

    renderer = vtkRenderer()
    ren_win = vtkRenderWindow()
    ren_win.AddRenderer(renderer)
    ren_win.SetWindowName("CellPicking")
    iren = vtkRenderWindowInteractor()
    iren.SetRenderWindow(ren_win)
    # add text actor
    renderer.AddActor(create_text_actor("hello trame"))

    renderer.AddActor(actor)
    renderer.ResetCamera()
    renderer.SetBackground(colors.GetColor3d("PaleTurquoise"))

    return ren_win


class App:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")
        self.render_window = setup_vtk()
        self.ui = self._build_ui()

    def _build_ui(self):
        with SinglePageLayout(self.server) as layout:
            layout.title.set_text("Hello trame")

            with layout.content:
                with vuetify3.VContainer(
                    fluid=True,
                    classes="pa-0 fill-height",
                ):
                    with vuetify3.VCol(classes="pa-0 ma-1 fill-height"):
                        if USE_WASM:
                            vtklocal.LocalView(self.render_window, throttle_rate=20)
                        else:
                            from trame.widgets import vtk as vtkw

                            vtkw.VtkRemoteView(self.render_window, interactive_ratio=1)


if __name__ == "__main__":
    app = App()
    app.server.start()
