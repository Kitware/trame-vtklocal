import math
import os
from vtkmodules.vtkChartsCore import vtkChart, vtkChartXY, vtkPlotPoints
from vtkmodules.vtkCommonColor import vtkNamedColors
from vtkmodules.vtkCommonCore import vtkFloatArray
from vtkmodules.vtkCommonDataModel import vtkTable
from vtkmodules.vtkViewsContext2D import vtkContextView


# Required for vtk factory
import vtkmodules.vtkRenderingContextOpenGL2  # noqa
import vtkmodules.vtkRenderingOpenGL2  # noqa
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa

from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client, vtk as vtk_widgets
from trame_vtklocal.widgets import vtklocal

WASM = "USE_WASM" in os.environ


def create_vtk_pipeline():
    colors = vtkNamedColors()

    view = vtkContextView()
    view.GetRenderer().SetBackground(colors.GetColor3d("SlateGray"))
    view.GetRenderWindow().SetSize(400, 300)

    chart = vtkChartXY()
    view.GetScene().AddItem(chart)
    chart.SetShowLegend(True)

    table = vtkTable()

    arrX = vtkFloatArray()
    arrX.SetName("X Axis")

    arrC = vtkFloatArray()
    arrC.SetName("Cosine")

    arrS = vtkFloatArray()
    arrS.SetName("Sine")

    arrT = vtkFloatArray()
    arrT.SetName("Sine-Cosine")

    table.AddColumn(arrC)
    table.AddColumn(arrS)
    table.AddColumn(arrX)
    table.AddColumn(arrT)

    numPoints = 40

    inc = 7.5 / (numPoints - 1)
    table.SetNumberOfRows(numPoints)
    for i in range(numPoints):
        table.SetValue(i, 0, i * inc)
        table.SetValue(i, 1, math.cos(i * inc))
        table.SetValue(i, 2, math.sin(i * inc))
        table.SetValue(i, 3, math.sin(i * inc) - math.cos(i * inc))

    points = chart.AddPlot(vtkChart.POINTS)
    points.SetInputData(table, 0, 1)
    points.SetColor(0, 0, 0, 255)
    points.SetWidth(1.0)
    points.SetMarkerStyle(vtkPlotPoints.CROSS)

    points = chart.AddPlot(vtkChart.POINTS)
    points.SetInputData(table, 0, 2)
    points.SetColor(0, 0, 0, 255)
    points.SetWidth(1.0)
    points.SetMarkerStyle(vtkPlotPoints.PLUS)

    points = chart.AddPlot(vtkChart.POINTS)
    points.SetInputData(table, 0, 3)
    points.SetColor(0, 0, 255, 255)
    points.SetWidth(1.0)
    points.SetMarkerStyle(vtkPlotPoints.CIRCLE)

    view.GetRenderWindow().SetMultiSamples(0)
    view.GetRenderWindow().SetWindowName("ScatterPlot")

    return view.GetRenderWindow()


class App:
    def __init__(self, server=None):
        self.server = get_server(server, client_type="vue3")
        self.render_window = create_vtk_pipeline()
        self.html_view = None
        self.ui = self._ui()

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

        return layout


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = App()
    app.server.start()
