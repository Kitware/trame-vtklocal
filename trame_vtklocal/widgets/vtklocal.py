import io
import json
import zipfile
import base64
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
    LocalView allow to mirror a server side vtkRenderWindow on the client side using VTK.wasm.

    Parameters

    :param render_window: Specify the VTK window to mirror
    :type vtkRenderWindow:
    :param throttle_rate: Number of update per second the render_throttle() method will actually perform.
    :type number:

    Properties

    :param cache_size: Size of client side cache for geometry and arrays in Bytes.
    :type number:
    :param eager_sync: If enabled, the server will push states rather than waiting for the client to request them. Usually improve fast update behavior.
    :type bool:
    :param listeners: Dynamic structure describing what to observe and how to map internal WASM state to trame state variable.
    :type dict:

    Events

    :param updated: Emitted after each completed client side update.
    :param memory_vtk: Event which provides the current memory used by vtk object structures.
    :param memory_arrays: Event which provides the current memory used by vtk arrays.
    :param camera: Event emitted when any camera is changed. The actual state of the camera is passed as arg.

    """

    _next_id = 0

    def __init__(self, render_window, throttle_rate=10, **kwargs):
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
        ]

        # Generate throttle update function
        self._update_throttle = Throttle(self.update)
        self._update_throttle.rate = throttle_rate

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

        >>> html_view.update_throttle.rate = 15 # time per second
        >>> html_view.update_throttle()
        """
        return self._update_throttle

    def update(self, push_camera=False):
        """Sync view by pushing updates to client"""
        self.api.update(push_camera=push_camera)
        self.server.js_call(self.__ref, "update")

    def register_widget(self, w):
        """Register external element (i.e. widget) into the scene so it can be managed and return its wasm_id"""
        if w not in self.__registered_obj:
            self.api.register_widget(self._render_window, w)
            self.__registered_obj.append(w)
            self.api.update()

        return self.get_wasm_id(w)

    def uregister_widgets(self):
        """Unregister external element (i.e. widget) from the scene so it can removed from tracking"""
        for w in self.__registered_obj:
            self.api.unregister(self._render_window, w)

        self.__registered_obj.clear()

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


__all__ = [
    "LocalView",
]
