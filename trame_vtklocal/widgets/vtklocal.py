import io
import json
import zipfile
import base64
from pathlib import Path
from trame_client.widgets.core import AbstractElement
from .. import module

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


__all__ = [
    "LocalView",
]


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
    _next_id = 0

    def __init__(self, render_window, **kwargs):
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
        ]
        self._event_names += [
            "updated",
            ("memory_vtk", "memory-vtk"),
            ("memory_arrays", "memory-arrays"),
        ]

    @property
    def api(self):
        return module.get_helper(self.server).api

    @property
    def object_manager(self):
        return self.api.vtk_object_manager

    def update(self):
        self.api.update()
        self.server.js_call(self.__ref, "update")

    def register_widget(self, w):
        if w not in self.__registered_obj:
            self.__registered_obj.append(w)
            self.object_manager.RegisterObject(w)

    def uregister_widgets(self):
        for w in self.__registered_obj:
            self.object_manager.UnRegisterObject(w)

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

    def reset_camera(self, **kwargs):
        self._render_window.GetRenderers().GetFirstRenderer().ResetCamera()
        self._render_window.Render()
        self.object_manager.UpdateStatesFromObjects()
        self.update()

    @property
    def ref_name(self):
        return self.__ref

    def get_wasm_id(self, vtk_object):
        return self.object_manager.GetId(vtk_object)
