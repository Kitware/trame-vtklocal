from trame.app import TrameApp
from trame.ui.html import DivLayout
from trame.widgets import html, client
from trame_vtklocal.widgets import vtklocal

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa

from vtkmodules.vtkFiltersSources import vtkSphereSource
from vtkmodules.vtkInteractionWidgets import vtkBorderWidget, vtkBorderRepresentation
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkPolyDataMapper,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkRenderer,
)


def create_vtk_pipeline():
    ss = vtkSphereSource()
    mapper = vtkPolyDataMapper()
    mapper.SetInputConnection(ss.GetOutputPort())
    actor = vtkActor()
    actor.SetMapper(mapper)

    # A renderer and render window
    renderer = vtkRenderer()
    renderer.AddActor(actor)
    renderer.SetBackground(0.1, 0.2, 0.4)
    renwin = vtkRenderWindow(off_screen_rendering=True)
    renwin.AddRenderer(renderer)

    # An interactor
    interactor = vtkRenderWindowInteractor()
    interactor.SetRenderWindow(renwin)
    interactor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

    # widget
    rep = vtkBorderRepresentation()
    rep.SetShowBorderToOn()
    rep.SetBorderColor(1, 0, 0)
    rep.SetBorderThickness(15)

    widget = vtkBorderWidget()
    widget.SetInteractor(interactor)
    widget.SetRepresentation(rep)
    widget.SelectableOff()
    renderer.ResetCamera()
    renwin.Render()

    return renwin, widget, actor


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------


class BorderWidget(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)

        self.render_window, self.widget, self.actor = create_vtk_pipeline()
        self.widget.On()
        self._build_ui()

    def _build_ui(self):
        with DivLayout(self.server) as layout:
            client.Style("body { margin: 0; }")
            with html.Div(
                style="position: absolute; left: 0; top: 0; width: 100vw; height: 100vh;"
            ):
                vtklocal.LocalView(
                    self.render_window,
                    throttle_rate=20,
                    ctx_name="view",
                )
                self.widget_id = self.ctx.view.register_widget(self.widget)

        return layout


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = BorderWidget()
    app.server.start()
