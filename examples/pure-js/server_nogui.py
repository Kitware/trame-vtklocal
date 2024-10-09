import vtk

from trame.app import get_server
from trame.widgets import vtklocal
from trame.decorators import TrameApp, change, trigger


def create_vtk_pipeline():
    renderer = vtk.vtkRenderer()
    rw = vtk.vtkRenderWindow()
    # rw.OffScreenRenderingOn()
    rw.AddRenderer(renderer)
    rwi = vtk.vtkRenderWindowInteractor(render_window=rw)
    rwi.interactor_style.SetCurrentStyleToTrackballCamera()

    cone = vtk.vtkConeSource()

    mapper = vtk.vtkPolyDataMapper(input_connection=cone.output_port)
    actor = vtk.vtkActor(mapper=mapper)

    renderer.AddActor(actor)
    renderer.background = (0.1, 0.2, 0.4)
    renderer.ResetCamera()

    return rw, cone


@TrameApp()
class WasmApp:
    def __init__(self, server=None):
        self.server = get_server(server)
        self.render_window, self.cone = create_vtk_pipeline()

        # Server side helper for WASM view handling
        view = vtklocal.LocalView(self.render_window, trame_server=self.server)
        view.update_throttle.rate = 20  # max update rate
        self.ctrl.view_update = view.update_throttle
        self.ctrl.view_reset_camera = view.reset_camera

        # Share info tor pure JS client
        self.state.wasm_render_window_id = view.get_wasm_id(self.render_window)
        self.state.wasm_render_window_ref = view.ref_name

    @property
    def ctrl(self):
        return self.server.controller

    @property
    def state(self):
        return self.server.state

    @change("resolution")
    def on_resolution_change(self, resolution, **_):
        print(f"{resolution=}")
        self.cone.SetResolution(int(resolution))
        self.ctrl.view_update()

    @trigger("reset_camera")
    def reset_camera(self):
        print("reset_camera from JS")
        self.ctrl.view_reset_camera()

    @trigger("reset_resolution")
    def reset_resolution(self):
        print("reset_resolution from JS")
        self.state.resolution = 6


def main():
    app = WasmApp()
    app.server.start()


if __name__ == "__main__":
    main()
