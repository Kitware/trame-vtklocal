#!/usr/bin/env -S uv run --script
#
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "trame>=3.13.2",
#     "trame-vtklocal",
#     "vtk==9.7.20260913.dev0",
# ]
#
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
# ///
import vtk

from trame.app import TrameApp
from trame.ui.html import DivLayout
from trame.widgets import vtklocal, rca, html, client
from trame.decorators import change


def setup_scene():
    renderer = vtk.vtkRenderer()
    rw = vtk.vtkRenderWindow()
    rw.AddRenderer(renderer)
    rwi = vtk.vtkRenderWindowInteractor(render_window=rw)
    rwi.interactor_style.SetCurrentStyleToTrackballCamera()

    cone = vtk.vtkConeSource()

    mapper = vtk.vtkPolyDataMapper(input_connection=cone.output_port)
    actor = vtk.vtkActor(mapper=mapper)

    renderer.AddActor(actor)
    renderer.background = (0.1, 0.2, 0.4)
    renderer.ResetCamera()

    return rw


class RemoteLocal(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)
        self.render_window = setup_scene()
        self.state.localRendering = False
        with DivLayout(self.server) as self.ui:
            self.ui.root.style = "height: 100vh;"
            client.Style("""
                html, body { margin:0; padding:0; }
                .stack { display: grid; height: 100%; }
                .stack > * { grid-area: 1 / 1; }
                .fade-enter-active,
                .fade-leave-active {
                  transition: opacity 1s ease;
                }
                .fade-enter-from {
                  opacity: 0;
                }
                .fade-leave-to {
                  opacity: 0.9;
                }
                """)
            with html.Div(classes="stack"):
                with html.Transition(name="fade"):
                    rca_view = rca.RemoteControlledArea(
                        display="image",
                        v_if="!localRendering",
                    )
                    self.rca_handler = rca_view.create_view_handler(
                        self.render_window,
                        encoder="turbo-jpeg",
                        target_fps=60,
                    )
                    self.wasm = vtklocal.LocalView(
                        self.render_window,
                        end_interaction=(self._sync_camera, "[$event]"),
                        v_if="localRendering",
                    )

            html.Button(
                "{{ localRendering ? 'Local Rendering' : 'Remote Rendering' }}",
                style="position:absolute;top:1rem;left:1rem;padding:5px;",
                click="localRendering=!localRendering",
            )

    def _sync_camera(self, camera_states):
        for vtk_state in camera_states:
            self.wasm.vtk_update_from_state(vtk_state)

    @change("localRendering")
    def _on_change(self, localRendering, **_):
        if localRendering:
            self.wasm.update(push_camera=True)


def main():
    app = RemoteLocal()
    app.server.start()


if __name__ == "__main__":
    main()
