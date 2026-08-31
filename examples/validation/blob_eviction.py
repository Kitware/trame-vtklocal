#!/usr/bin/env -S uv run --script
#
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "trame>=3.13.2",
#     "trame-vtklocal",
#     "vtk==9.7.20260726.dev0",
# ]
#
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
# ///

"""Blob eviction corrupts sibling views that share a RemoteSession.

    uv run examples/issues/shared_session_blob_eviction.py --server

Then open the browser devtools console. The failure shows up on page load,
before you click anything:

    Registered <hash-A>, 8388608          <- ref view fetches its volume
    Updated in ...
    Unregistered blob <hash-A>            <- freeMemory() drops it immediately
    Unregistered blob ...
    Registered <hash-B>, 8388608          <- tgt view fetches its volume
    ERR| vtkMarshalContext: vtkDeserializer failed to find blob for hash=<hash-A>
    ERR| ... Superclass deserialization failed        (x N, up to
    ERR| vtkWebAssemblyOpenGLRen...: Superclass deserialization failed)

`Array memory` in the toolbar reads far below `Working set` for the same
reason: the blobs both views are actively rendering from are gone.


What is broken
--------------

All LocalViews backed by the same wasm runtime share ONE RemoteSession
(``WASM_REMOTE_SESSIONS[runtime.id]`` in ``VtkLocal.js``), hence one native
object manager and one blob store. Eviction is session-wide, but every piece
of "is this blob still needed" bookkeeping is per-render-window:

1. ``freeMemory()`` starts from ``min(hashesMTime)``, and blobs fetched during
   the update that just ran all carry the same mtime -- so the very first pass
   evicts the whole generation that was just fetched and is currently on
   screen. One view whose working set alone exceeds ``cache_size`` therefore
   wipes the store down to zero.

2. ``hashesMTime[hash]`` is only stamped when a blob is fetched, never when the
   server reports it again in ``serverStatus.hashes``. A blob in continuous use
   keeps aging and eventually looks like the coldest thing in the cache.

3. Nothing refetches it. ``get_status`` returns
   ``GetBlobHashes(GetAllDependencies(obj_id))`` -- the deps of *that* render
   window only -- so the tgt view's status never mentions the ref view's
   hashes, and ``#doUpdateAsync`` only fetches hashes it was told about.

4. ``vtkObjectManager::UpdateObjectsFromStates()`` deserializes *every*
   kept-alive root in the shared context, not just the window being updated.
   So the tgt view's update walks the ref view's render window subtree, hits
   the evicted blob, and the failure cascades all the way up.

Set `Cache size` to 64 MB in the toolbar (above the 16 MB combined working
set) and the errors stop, that is the workaround, but we need better fix.
"""

# Required for vtk factories
import vtkmodules.vtkRenderingOpenGL2  # noqa: F401
import vtkmodules.vtkRenderingVolumeOpenGL2  # noqa: F401
from trame.app import TrameApp
from trame.ui.html import DivLayout
from trame.widgets import client, html
from vtkmodules.vtkCommonDataModel import vtkPiecewiseFunction
from vtkmodules.vtkImagingCore import vtkRTAnalyticSource
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa: F401
from vtkmodules.vtkRenderingCore import (
    vtkColorTransferFunction,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
    vtkVolume,
    vtkVolumeProperty,
)
from vtkmodules.vtkRenderingVolumeOpenGL2 import vtkSmartVolumeMapper

from trame_vtklocal.utils import ui
from trame_vtklocal.widgets import vtklocal

# 128^3 float32 = 8 MB per view, 16 MB for the pair.
DIM = 128
VOLUME_BYTES = DIM * DIM * DIM * 4

# Below one view's working set: the first update evicts everything it just
# fetched, so the sibling view breaks on its very next update.
SMALL_CACHE = 4 * 1024 * 1024

# Above the combined working set: nothing is ever evicted.
LARGE_CACHE = 64 * 1024 * 1024

VIEW_STYLE = "flex: 1; min-width: 0; height: 100%;"

# -----------------------------------------------------------------------------
# VTK pipeline
# -----------------------------------------------------------------------------


def create_vtk_pipeline(maximum):
    """A volume big enough to matter, with data unique to this view.

    `maximum` changes the sample values, hence the array's blob hash, so the
    two views never share the volume blob the way they would with identical
    sources.
    """
    source = vtkRTAnalyticSource()
    source.SetWholeExtent(0, DIM - 1, 0, DIM - 1, 0, DIM - 1)
    source.SetMaximum(maximum)
    source.Update()

    low, high = source.GetOutput().GetScalarRange()
    mid = 0.5 * (low + high)

    color = vtkColorTransferFunction()
    color.AddRGBPoint(low, 0.0, 0.0, 1.0)
    color.AddRGBPoint(mid, 1.0, 1.0, 1.0)
    color.AddRGBPoint(high, 1.0, 0.0, 0.0)

    opacity = vtkPiecewiseFunction()
    opacity.AddPoint(low, 0.0)
    opacity.AddPoint(mid, 0.05)
    opacity.AddPoint(high, 0.3)

    volume_property = vtkVolumeProperty()
    volume_property.SetColor(color)
    volume_property.SetScalarOpacity(opacity)
    volume_property.ShadeOff()
    volume_property.SetInterpolationTypeToLinear()

    mapper = vtkSmartVolumeMapper()
    mapper.SetInputConnection(source.GetOutputPort())

    volume = vtkVolume()
    volume.SetMapper(mapper)
    volume.SetProperty(volume_property)

    renderer = vtkRenderer()
    renderer.AddVolume(volume)
    renderer.SetBackground(0.1, 0.2, 0.4)

    render_window = vtkRenderWindow()
    render_window.AddRenderer(renderer)

    interactor = vtkRenderWindowInteractor()
    interactor.SetRenderWindow(render_window)
    interactor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

    renderer.ResetCamera()

    return render_window, renderer


# -----------------------------------------------------------------------------
# App
# -----------------------------------------------------------------------------


class DemoApp(TrameApp):
    def __init__(self, server=None):
        super().__init__(server, client_type="vue3")
        self.ref_window, self.ref_renderer = create_vtk_pipeline(255)
        self.tgt_window, self.tgt_renderer = create_vtk_pipeline(511)
        self._tick = 0

        self.state.setdefault("cache_size", SMALL_CACHE)
        self.state.setdefault("working_set", 2 * VOLUME_BYTES)
        self.state.setdefault("mem_arrays", 0)
        self.state.setdefault("updates", 0)

        self._build_ui()

    # Update drivers ----------------------------------------------------------

    def _touch(self, renderer):
        """Nudge one property so the update carries a changed state.

        Without a state change the client skips `updateObjectsFromStates()`
        entirely and the missing blob is never looked up.
        """
        self._tick += 1
        renderer.SetBackground(0.1, 0.2 + 0.02 * (self._tick % 5), 0.4)

    def update_ref(self):
        self._touch(self.ref_renderer)
        self.ctx.ref_view.update()

    def update_tgt(self):
        self._touch(self.tgt_renderer)
        self.ctx.tgt_view.update()

    def ping_pong(self):
        """Alternate the two views to keep the eviction/refetch cycle running.

        Updates on the shared session are serialized client side, so issuing
        them back to back is enough to interleave them.
        """
        for i in range(6):
            if i % 2:
                self.update_tgt()
            else:
                self.update_ref()

    def use_small_cache(self):
        self.state.cache_size = SMALL_CACHE

    def use_large_cache(self):
        self.state.cache_size = LARGE_CACHE

    # Reporting ---------------------------------------------------------------

    def on_memory_arrays(self, value, **_):
        # Emitted from checkMemory(), i.e. AFTER freeMemory() ran. With the
        # small cache this reads well under `working_set` even though both
        # views are on screen and rendering from those very blobs.
        self.state.mem_arrays = int(value)

    def on_updated(self, **_):
        self.state.updates += 1

    # UI ----------------------------------------------------------------------

    def _build_ui(self):
        with DivLayout(self.server) as self.ui:
            client.Style("body { margin: 0; }")
            with html.Div(
                style=ui.FULL_SCREEN + "display: flex; padding-top: 5rem;",
            ):
                vtklocal.LocalView(
                    self.ref_window,
                    ctx_name="ref_view",
                    style=VIEW_STYLE,
                    cache_size=("cache_size",),
                    emit_memory=True,
                    memory_arrays=(self.on_memory_arrays, "[$event]"),
                    updated=(self.on_updated,),
                )
                vtklocal.LocalView(
                    self.tgt_window,
                    ctx_name="tgt_view",
                    style=VIEW_STYLE,
                    cache_size=("cache_size",),
                    emit_memory=True,
                    memory_arrays=(self.on_memory_arrays, "[$event]"),
                    updated=(self.on_updated,),
                )

            with ui.Toolbar():
                html.Button("Update ref", click=self.update_ref)
                html.Button("Update tgt", click=self.update_tgt)
                html.Button("Ping-pong x6", click=self.ping_pong)

                ui.Separator()

                with ui.Element("Cache size"):
                    html.Button(
                        f"{SMALL_CACHE // (1024 * 1024)} MB (broken)",
                        click=self.use_small_cache,
                    )
                    html.Button(
                        f"{LARGE_CACHE // (1024 * 1024)} MB (workaround)",
                        click=self.use_large_cache,
                    )

                ui.Separator()

                html.Div("Cache {{ (cache_size / 1048576).toFixed(1) }} MB")
                html.Div("Working set {{ (working_set / 1048576).toFixed(1) }} MB")
                html.Div("Array memory {{ (mem_arrays / 1048576).toFixed(1) }} MB")
                html.Div("Updates {{ updates }}")

                ui.Separator()

                html.Div(
                    "Console: 'Unregistered blob' then 'failed to find blob for hash='",
                    style="opacity: 0.6;",
                )


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = DemoApp()
    app.server.start()
