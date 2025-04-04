import asyncio
import io
import json
import zipfile
import base64
import warnings
from pathlib import Path
from trame_client.widgets.core import AbstractElement
from trame_vtklocal import module
from trame_vtklocal.utils.throttle import Throttle

try:
    import zlib  # noqa

    ZIP_COMPRESSION = zipfile.ZIP_DEFLATED
except ImportError:
    ZIP_COMPRESSION = zipfile.ZIP_STORED


class HtmlElement(AbstractElement):
    def __init__(self, _elem_name, children=None, **kwargs):
        super().__init__(_elem_name, children, **kwargs)
        if self.server:
            self.server.enable_module(module)


def encode_blobs(blob_map):
    result = {}
    for key in blob_map:
        result[key] = base64.b64encode(bytes(blob_map[key].get("bytes", []))).decode(
            "utf-8"
        )

    return result


def get_version():
    from vtkmodules.vtkCommonCore import vtkVersion

    vtk_version = vtkVersion()
    return vtk_version.GetVTKVersion()


class LocalView(HtmlElement):
    """
    LocalView allow to mirror a server side vtkRenderWindow
    on the client side using VTK.wasm.

    Args:
        render_window (vtkRenderWindow):
            Specify the VTK window to mirror
        throttle_rate (number):
            Number of update per second the render_throttle()
            method will actually perform.
        cache_size (number):
            Size of client side cache for geometry and arrays in Bytes.
        eager_sync (bool):
            If enabled, the server will push states rather than waiting
            for the client to request them. Usually improve fast update behavior.
        listeners (dict):
            Dynamic structure describing what to observe and how to map internal
            WASM state to trame state variable.
        updated (event):
            Emitted after each completed client side update.
        memory_vtk (event):
            Event which provides the current memory used by vtk object structures.
        memory_arrays (event):
            Event which provides the current memory used by vtk arrays.
        camera (event):
            Event emitted when any camera is changed. The actual state of
            the camera is passed as arg.

    """

    _next_id = 0

    def __init__(self, render_window, throttle_rate=10, **kwargs):
        # Register response callback if not overridden
        kwargs.setdefault("invoke_response", (self._on_invoke_response, "[$event]"))
        self._pending_invoke_result = None

        super().__init__(
            "vtk-local",
            **kwargs,
        )
        self.__registered_obj = []
        self.__ref = kwargs.get("ref")
        if self.__ref is None:
            LocalView._next_id += 1
            self.__ref = f"_vtklocalview_{LocalView._next_id}"

        # Must trigger update after registration
        self._render_window = render_window
        self._window_id = self.object_manager.RegisterObject(render_window)
        render_window.Render()
        self.object_manager.UpdateStatesFromObjects()
        if self.api._debug_state:
            self.object_manager.Export(f"snapshot-{self.api._debug_state_counter}")

        self._attributes["rw_id"] = f':render-window="{self._window_id}"'
        self._attributes["ref"] = f'ref="{self.__ref}"'
        self._attr_names += [
            ("cache_size", "cacheSize"),
            ("eager_sync", "eagerSync"),
            ("listeners", ":listeners"),
        ]
        self._event_names += [
            "updated",
            "camera",
            ("memory_vtk", "memory-vtk"),
            ("memory_arrays", "memory-arrays"),
            ("invoke_response", "invoke-response"),
        ]

        # Generate throttle update function
        self._update_throttle = Throttle(self.update)
        self._update_throttle.rate = throttle_rate

    def _on_invoke_response(self, response):
        if self._pending_invoke_result is None:
            return
        self._pending_invoke_result.set_result(response)

    @property
    def api(self):
        """Return API from helper"""
        return module.get_helper(self.server).api

    @property
    def object_manager(self):
        """Return object_manager"""
        return self.api.vtk_object_manager

    def eval(self, state_mapping):
        """Evaluate WASM state extract and map it onto trame state variables

        >>> html_view.eval({
        ...    "trame_state_name": {
        ...        "prop_name1": (wasm_id, "PropName"),
        ...        "origin": (wasm_id, "WidgetRepresentation", "origin"),
        ...        "widget_state": widget_id,
        ...    }
        ... }
        """
        self.server.js_call(self.__ref, "evalStateExtract", state_mapping)

    @property
    def update_throttle(self):
        """Throttled update method on which you can update its rate by doing

        >>> html_view.update_throttle.rate = 15  # time per second
        >>> html_view.update_throttle()
        """
        return self._update_throttle

    def update(self, push_camera=False):
        """Sync view by pushing updates to client"""
        self.api.update(push_camera=push_camera)
        self.server.js_call(self.__ref, "update")

    def register_vtk_object(self, vtk_instance):
        """Register external element (i.e. widget) into the scene so it can be managed and return its wasm_id"""
        if vtk_instance not in self.__registered_obj:
            self.api.register_widget(self._render_window, vtk_instance)
            self.__registered_obj.append(vtk_instance)
            self.api.update()

        return self.get_wasm_id(vtk_instance)

    def register_widget(self, w):
        """Register external element (i.e. widget) into the scene so it can be managed and return its wasm_id"""
        warnings.warn(
            "register_widget() is deprecated, use register_vtk_object() instead"
        )
        return self.register_vtk_object(w)

    def unregister_vtk_object(self, vtk_instance):
        """Unregister external element (i.e. widget) from the scene so it can removed from tracking"""
        if vtk_instance in self.__registered_obj:
            self.api.unregister(self._render_window, vtk_instance)
            return True

        return False

    def unregister_all_vtk_objects(self):
        """Unregister all external element (i.e. widget) from the scene"""
        for vtk_instance in self.__registered_obj:
            self.api.unregister(self._render_window, vtk_instance)
            self.__registered_obj.remove(vtk_instance)

    def unregister_widgets(self):
        """Unregister all external element (i.e. widget) from the scene"""
        warnings.warn(
            "unregister_widgets() is deprecated, use unregister_all_vtk_objects() instead"
        )
        self.unregister_all_vtk_objects()

    def export(self, format="zip", **kwargs):
        """Export standalone scene for WASMViewer

        :param format: Can be either be "zip" or "json".
        """
        base_name = str(Path(f"snapshot-{self.api._debug_state_counter}").resolve())
        self.object_manager.Export(base_name)
        states_file = Path(f"{base_name}.states.json")
        blobs_file = Path(f"{base_name}.blobs.json")

        json_structure = {
            "version": get_version(),
            "states": json.loads(states_file.read_text()),
            "blobs": encode_blobs(json.loads(blobs_file.read_text())),
        }
        states_file.unlink()
        blobs_file.unlink()

        # write json file to disk
        if format == "json":
            json_out = json.dumps(json_structure)
            return json_out.encode(encoding="UTF-8", errors="strict")
        if format == "zip":
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, "a") as zfile:
                zfile.writestr(
                    "index.json",
                    json.dumps(json_structure),
                    compress_type=ZIP_COMPRESSION,
                )

            return zip_buffer.getvalue()

    def reset_camera(self, renderer_or_render_window=None, **kwargs):
        """Reset camera by making the call on the client side"""
        if renderer_or_render_window is None:
            renderer_or_render_window = self._render_window

        if renderer_or_render_window.IsA("vtkRenderWindow"):
            renderer_or_render_window = (
                renderer_or_render_window.GetRenderers().GetFirstRenderer()
            )

        if renderer_or_render_window.IsA("vtkRenderer"):
            id_to_reset_camera = self.get_wasm_id(renderer_or_render_window)
            self.server.js_call(self.__ref, "resetCamera", id_to_reset_camera)

    @property
    def ref_name(self):
        """Return the assigned name as a vue.js ref"""
        return self.__ref

    def get_wasm_id(self, vtk_object):
        """Return vtkObject id used within WASM scene manager"""
        return self.object_manager.GetId(vtk_object)

    def get_vtk_obj(self, wasm_id):
        """Return corresponding VTK object"""
        return self.object_manager.GetObjectAtId(wasm_id)

    def vtk_update_from_state(self, state_obj):
        """Use a state from WASM to update a VTK object"""
        if isinstance(state_obj, dict):
            state_obj = json.dumps(state_obj)

        self.object_manager.UpdateObjectFromState(state_obj)

    async def invoke(self, vtk_obj, method, *args):
        wasm_id = vtk_obj
        if hasattr(vtk_obj, "IsA"):  # vtkObject
            wasm_id = self.get_wasm_id(vtk_obj)

        self._pending_invoke_result = asyncio.get_running_loop().create_future()
        self.server.js_call(self.__ref, "invoke", wasm_id, method, args)
        await self._pending_invoke_result
        return self._pending_invoke_result.result()

    def print_scene_manager_information(self):
        self.server.js_call(self.__ref, "printSceneManagerInformation")


__all__ = [
    "LocalView",
]
