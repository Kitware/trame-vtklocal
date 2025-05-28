#!/usr/bin/env -S uv run --script
#
# /// script
# requires-python = ">=3.9"
# dependencies = [
#     "trame",
#     "trame-vtklocal",
#     "trame-vuetify",
#     "vtk==9.4.20250510.dev0",
# ]
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
# ///
import vtk

# trame imports
from trame.app import TrameApp
from trame.ui.vuetify3 import SinglePageLayout
from trame.widgets import vuetify3, vtklocal


def get_scalar_bar(colorTransferFunction):
    scalar_bar = vtk.vtkScalarBarActor()
    scalar_bar.SetLookupTable(colorTransferFunction)
    scalar_bar.SetTitle("Color Temp")
    scalar_bar.UnconstrainedFontSizeOn()
    scalar_bar.SetNumberOfLabels(10)
    scalar_bar.SetMaximumWidthInPixels(800 // 8)
    scalar_bar.SetMaximumHeightInPixels(800 // 3)
    scalar_bar.SetObjectName("ScalarBar")
    return scalar_bar


def get_render_window():
    ren1 = vtk.vtkRenderer()
    colorTransferFunction = vtk.vtkColorTransferFunction()
    colorTransferFunction.AddRGBPoint(0.0, 0.69, 0.69, 0.69)
    colorTransferFunction.AddRGBPoint(1.0, 1.0, 0.3, 0.3)
    scalar_bar = get_scalar_bar(colorTransferFunction)
    ren1.AddActor2D(scalar_bar)
    renderWindow = vtk.vtkRenderWindow()
    renderWindow.AddRenderer(ren1)
    renderWindow.Render()
    return renderWindow


class App(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)
        renderWindow = get_render_window()

        with SinglePageLayout(self.server) as layout:
            layout.title.set_text("2D View")
            with layout.content:
                with vuetify3.VContainer(
                    fluid=True,
                    classes="pa-0 fill-height",
                ):
                    view = vtklocal.LocalView(renderWindow)


def main():
    app = App()
    app.server.start()


if __name__ == "__main__":
    main()
