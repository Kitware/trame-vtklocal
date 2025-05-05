import vtk

from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client  # , vtklocal
from trame_vtklocal.widgets import vtklocal  # just for -e compatibility
from trame.decorators import TrameApp, change
from trame.assets.remote import HttpFile

FULL_SCREEN = "position:absolute; left:0; top:0; width:100vw; height:100vh;"
K_RANGE = [0.0, 15.6]

BIKE = HttpFile(
    "bike.vtp", "https://github.com/Kitware/trame-app-bike/raw/master/data/bike.vtp"
)
TUNNEL = HttpFile(
    "tunnel.vtu", "https://github.com/Kitware/trame-app-bike/raw/master/data/tunnel.vtu"
)

if not BIKE.local:
    BIKE.fetch()

if not TUNNEL.local:
    TUNNEL.fetch()


def create_vtk_pipeline():
    renderer = vtk.vtkRenderer()
    renderWindow = vtk.vtkRenderWindow()
    renderWindow.AddRenderer(renderer)
    renderWindow.OffScreenRenderingOn()

    renderWindowInteractor = vtk.vtkRenderWindowInteractor()
    renderWindowInteractor.SetRenderWindow(renderWindow)
    renderWindowInteractor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

    bikeReader = vtk.vtkXMLPolyDataReader()
    bikeReader.SetFileName(BIKE.path)

    tunnelReader = vtk.vtkXMLUnstructuredGridReader()
    tunnelReader.SetFileName(TUNNEL.path)
    tunnelReader.Update()
    input_bounds = tunnelReader.output.bounds

    plane = vtk.vtkPlane(
        origin=(
            0.5 * (input_bounds[0] + input_bounds[1]),
            0.5 * (input_bounds[2] + input_bounds[3]),
            0.5 * (input_bounds[4] + input_bounds[5]),
        )
    )

    clipper = vtk.vtkCutter(
        cut_function=plane,
        input_connection=tunnelReader.output_port,
    )

    bike_mapper = vtk.vtkPolyDataMapper()
    bike_actor = vtk.vtkActor()
    bike_mapper.SetInputConnection(bikeReader.GetOutputPort())
    bike_actor.SetMapper(bike_mapper)
    renderer.AddActor(bike_actor)

    clip_mapper = vtk.vtkPolyDataMapper()
    clip_actor = vtk.vtkActor()
    clip_mapper.SetInputConnection(clipper.GetOutputPort())
    clip_actor.SetMapper(clip_mapper)
    renderer.AddActor(clip_actor)

    lut = vtk.vtkLookupTable()
    lut.SetHueRange(0.7, 0)
    lut.SetSaturationRange(1.0, 0)
    lut.SetValueRange(0.5, 1.0)

    clip_mapper.SetLookupTable(lut)
    clip_mapper.SetColorModeToMapScalars()
    clip_mapper.SetScalarModeToUsePointData()
    clip_mapper.SetArrayName("k")
    clip_mapper.SetScalarRange(K_RANGE)

    renderWindow.Render()
    renderer.ResetCamera()
    renderer.SetBackground(0.4, 0.4, 0.4)

    rep = vtk.vtkImplicitPlaneRepresentation(
        place_factor=1.25,
        outline_translation=False,
    )
    rep.DrawPlaneOff()
    rep.PlaceWidget(input_bounds)
    rep.normal = plane.normal
    rep.origin = plane.origin

    plane_widget = vtk.vtkImplicitPlaneWidget2(
        interactor=renderWindowInteractor, representation=rep
    )
    plane_widget.On()

    return renderWindow, plane, plane_widget


@TrameApp()
class App:
    def __init__(self, server=None):
        self.server = get_server(server)
        self.rw, self.plane, self.widget = create_vtk_pipeline()
        self._build_ui()

        # reserve state variable for widget update
        self.state.plane_widget = None

    @property
    def state(self):
        return self.server.state

    @property
    def ctrl(self):
        return self.server.controller

    @change("plane_widget")
    def _on_widget_update(self, plane_widget, **_):
        if plane_widget is None:
            return

        origin = plane_widget.get("origin")
        normal = plane_widget.get("normal")

        self.plane.SetOrigin(origin)
        self.plane.SetNormal(normal)

        # prevent requesting geometry too often
        self.ctrl.view_update()

    def _build_ui(self):
        with DivLayout(self.server):
            client.Style("body { margin: 0; }")
            with html.Div(style=FULL_SCREEN):
                with vtklocal.LocalView(self.rw) as view:
                    view.update_throttle.rate = 20
                    self.ctrl.view_update = view.update_throttle
                    self.widget_id = view.register_widget(self.widget)
                    view.listeners = (
                        "listeners",
                        {
                            self.widget_id: {
                                "InteractionEvent": {
                                    "plane_widget": {
                                        "origin": (
                                            self.widget_id,
                                            "WidgetRepresentation",
                                            "Origin",
                                        ),
                                        "normal": (
                                            self.widget_id,
                                            "WidgetRepresentation",
                                            "Normal",
                                        ),
                                    },
                                },
                            },
                        },
                    )


def main():
    app = App()
    app.server.start()


if __name__ == "__main__":
    main()
