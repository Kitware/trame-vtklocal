from trame_client.widgets.core import AbstractElement
from .. import module


class HtmlElement(AbstractElement):
    def __init__(self, _elem_name, children=None, **kwargs):
        super().__init__(_elem_name, children, **kwargs)
        if self.server:
            self.server.enable_module(module)


__all__ = [
    "LocalView",
]


class LocalView(HtmlElement):
    _next_id = 0

    def __init__(self, render_window, **kwargs):
        super().__init__(
            "vtk-local",
            **kwargs,
        )

        self.__ref = kwargs.get("ref")
        if self.__ref is None:
            LocalView._next_id += 1
            self.__ref = f"_vtklocalview_{LocalView._next_id}"

        # Must trigger update after registration
        self._window_id = self.object_manager.RegisterObject(render_window)
        self.api.update()

        self._attributes["rw_id"] = f':render-window="{self._window_id}"'
        self._attributes["ref"] = f'ref="{self.__ref}"'
        self._attr_names += []
        self._event_names += []

    @property
    def api(self):
        return module.get_helper(self.server).api

    @property
    def object_manager(self):
        return self.api.vtk_object_manager

    def update(self):
        updated_ids = self.api.update()
        # TODO broadcast modified [(id,mtime), ...]
        print(f"update({updated_ids=})")
        for vtk_id in updated_ids:
            vtk_obj = self.object_manager.GetObjectWithId(vtk_id)
            print(f" - {vtk_id}:{vtk_obj.GetClassName()}")
        self.server.js_call(
            self.__ref,
            "update",
        )
