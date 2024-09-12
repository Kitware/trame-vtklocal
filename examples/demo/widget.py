import vtk

from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtklocal
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
    resolution = 50
    point1 = [-0.4, 0, 0.05]
    point2 = [-0.4, 0, 1.5]

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

    lineSeed = vtk.vtkLineSource()
    lineSeed.SetPoint1(*point1)
    lineSeed.SetPoint2(*point2)
    lineSeed.SetResolution(resolution)
    lineSeed.Update()

    input_bounds = tunnelReader.output.bounds
    print(input_bounds)

    lineWidget = vtk.vtkLineWidget2()
    lineWidgetRep = lineWidget.GetRepresentation()
    lineWidgetRep.SetPoint1WorldPosition(point1)
    lineWidgetRep.SetPoint2WorldPosition(point2)
    lineWidget.SetInteractor(renderWindowInteractor)

    streamTracer = vtk.vtkStreamTracer()
    streamTracer.SetInputConnection(tunnelReader.GetOutputPort())
    streamTracer.SetSourceConnection(lineSeed.GetOutputPort())
    streamTracer.SetIntegrationDirectionToForward()
    streamTracer.SetIntegratorTypeToRungeKutta45()
    streamTracer.SetMaximumPropagation(3)
    streamTracer.SetIntegrationStepUnit(2)
    streamTracer.SetInitialIntegrationStep(0.2)
    streamTracer.SetMinimumIntegrationStep(0.01)
    streamTracer.SetMaximumIntegrationStep(0.5)
    streamTracer.SetMaximumError(0.000001)
    streamTracer.SetMaximumNumberOfSteps(2000)
    streamTracer.SetTerminalSpeed(0.00000000001)

    tubeFilter = vtk.vtkTubeFilter()
    tubeFilter.SetInputConnection(streamTracer.GetOutputPort())
    tubeFilter.SetRadius(0.01)
    tubeFilter.SetNumberOfSides(6)
    tubeFilter.CappingOn()
    tubeFilter.Update()

    bike_mapper = vtk.vtkPolyDataMapper()
    bike_actor = vtk.vtkActor()
    bike_mapper.SetInputConnection(bikeReader.GetOutputPort())
    bike_actor.SetMapper(bike_mapper)
    renderer.AddActor(bike_actor)

    stream_mapper = vtk.vtkPolyDataMapper()
    stream_actor = vtk.vtkActor()
    stream_mapper.SetInputConnection(tubeFilter.GetOutputPort())
    stream_actor.SetMapper(stream_mapper)
    renderer.AddActor(stream_actor)

    lut = vtk.vtkLookupTable()
    lut.SetHueRange(0.7, 0)
    lut.SetSaturationRange(1.0, 0)
    lut.SetValueRange(0.5, 1.0)

    stream_mapper.SetLookupTable(lut)
    stream_mapper.SetColorModeToMapScalars()
    stream_mapper.SetScalarModeToUsePointData()
    stream_mapper.SetArrayName("k")
    stream_mapper.SetScalarRange(K_RANGE)

    renderWindow.Render()
    renderer.ResetCamera()
    renderer.SetBackground(0.4, 0.4, 0.4)

    lineWidget.On()

    return renderWindow, lineSeed, lineWidget


@TrameApp()
class App:
    def __init__(self, server=None):
        self.server = get_server(server)
        self.rw, self.seed, self.widget = create_vtk_pipeline()
        self._build_ui()

        # reserve state variable for widget update
        self.state.line_widget = None

    @property
    def state(self):
        return self.server.state

    @property
    def ctrl(self):
        return self.server.controller

    @change("line_widget")
    def _on_widget_update(self, line_widget, **_):
        if line_widget is None:
            return

        p1 = line_widget.get("p1")
        p2 = line_widget.get("p2")

        self.seed.SetPoint1(p1)
        self.seed.SetPoint2(p2)

        # # prevent requesting geometry too often
        # BUG the widget REP go in the wrong spot on the WASM side
        # self.ctrl.view_update()

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
                                    "line_widget": {
                                        "p1": (
                                            self.widget_id,
                                            "WidgetRepresentation",
                                            "Point1WorldPosition",
                                        ),
                                        "p2": (
                                            self.widget_id,
                                            "WidgetRepresentation",
                                            "Point2WorldPosition",
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
