"""``ObjectManagerAPI.update`` serializes every root completely, and overlapping roots once."""

import json

import pytest
from vtkmodules.vtkFiltersSources import vtkSphereSource
from vtkmodules.vtkInteractionWidgets import vtkOrientationMarkerWidget
from vtkmodules.vtkRenderingAnnotation import vtkAxesActor
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkAssembly,
    vtkPolyDataMapper,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)
import vtkmodules.vtkInteractionStyle  # noqa: F401
import vtkmodules.vtkRenderingOpenGL2  # noqa: F401

from trame_vtklocal.module.protocol import API_NO_IDS_UPDATE, ObjectManagerAPI

pytestmark = pytest.mark.skipif(
    API_NO_IDS_UPDATE, reason="this VTK cannot update a subset of roots"
)


class RecordingManager:
    """Forward to a real ``vtkObjectManager`` and record each subset update."""

    def __init__(self, manager):
        self._manager = manager
        self.updated = []

    def UpdateStatesFromObjects(self, *args):
        if args:
            self.updated.append(list(args[0]))
        return self._manager.UpdateStatesFromObjects(*args)

    def __getattr__(self, name):
        return getattr(self._manager, name)


def actor_for(source):
    mapper = vtkPolyDataMapper()
    mapper.SetInputConnection(source.GetOutputPort())
    actor = vtkActor()
    actor.SetMapper(mapper)
    return actor


class Scene:
    """A window with three spheres, an orientation marker widget, and an actor
    outside the window that shares one sphere's source."""

    def __init__(self, attach_widget=True):
        self.window = vtkRenderWindow()
        self.window.SetOffScreenRendering(1)
        renderer = vtkRenderer()
        self.window.AddRenderer(renderer)
        self.interactor = vtkRenderWindowInteractor()
        self.interactor.SetRenderWindow(self.window)
        self.sources = []
        self.actors = []
        for i in range(3):
            source = vtkSphereSource()
            source.SetCenter(i, 0, 0)
            actor = actor_for(source)
            renderer.AddActor(actor)
            self.sources.append(source)
            self.actors.append(actor)
        self.widget = vtkOrientationMarkerWidget()
        self.widget.SetOrientationMarker(vtkAxesActor())
        if attach_widget:
            self.widget.SetInteractor(self.interactor)
            self.widget.EnabledOn()
        self.detached = actor_for(self.sources[0])

    def api(self, *extra_roots):
        """Register the window as ``LocalView`` does, then ``extra_roots``."""
        api = ObjectManagerAPI()
        api.vtk_object_manager.RegisterObject(self.window)
        api.vtk_object_manager.UpdateStatesFromObjects()
        for root in extra_roots:
            api.register_widget(self.window, root)
        recorder = RecordingManager(api.vtk_object_manager)
        api.vtk_object_manager = recorder
        return api, recorder


def scene(attach_widget=True):
    s = Scene(attach_widget)
    api, recorder = s.api(s.widget)
    api.update(obj_to_update=[s.window, s.widget])
    return api, recorder, s.window, s.widget, s.actors


def opacity_in_state(api, actor):
    manager = api.vtk_object_manager
    prop_id = manager.GetId(actor.GetProperty())
    return json.loads(manager.GetState(prop_id))["Opacity"]


def reference_dependencies(roots):
    """Each root's dependencies after a full update on a fresh manager."""
    api = ObjectManagerAPI()
    manager = api.vtk_object_manager
    for root in roots:
        manager.RegisterObject(root)
    manager.UpdateStatesFromObjects()
    return [len(manager.GetAllDependencies(manager.GetId(root))) for root in roots]


ORDERS = {
    "window first": lambda s: [s.window, s.widget, s.detached],
    "widget first": lambda s: [s.widget, s.window, s.detached],
    "detached first": lambda s: [s.detached, s.widget, s.window],
}


@pytest.mark.parametrize("order", ORDERS)
@pytest.mark.parametrize(
    "attach_widget", [True, False], ids=["widget-on", "widget-off"]
)
def test_every_root_records_its_whole_graph(order, attach_widget):
    s = Scene(attach_widget)
    api, recorder = s.api(s.widget, s.detached)
    roots = ORDERS[order](s)
    for _ in range(2):
        api.update(obj_to_update=roots)
        root_ids = [recorder.GetId(root) for root in roots]
        assert [recorder.GetState(i) for i in root_ids].count("null") == 0
        assert [
            len(recorder.GetAllDependencies(i)) for i in root_ids
        ] == reference_dependencies(roots)
        status_ids = {i for i, _ in api.get_status(recorder.GetId(s.window))["ids"]}
        assert recorder.GetId(s.detached.GetMapper()) in status_ids


def test_a_change_before_a_new_widgets_first_update_is_serialized():
    s = Scene()
    api, _ = s.api(s.widget)
    s.actors[1].GetProperty().SetOpacity(0.25)
    api.update(obj_to_update=[s.widget, s.window])
    assert opacity_in_state(api, s.actors[1]) == pytest.approx(0.25)


def test_a_root_inside_another_roots_graph_is_walked_once():
    api, recorder, window, widget, _ = scene()
    window_id = recorder.GetId(window)
    widget_id = recorder.GetId(widget)
    assert window_id in recorder.GetAllDependencies(widget_id)
    # The widget was new, so its graph was not known yet.
    assert recorder.updated == [[window_id, widget_id]]

    for roots in ([widget, window], [window, widget]):
        recorder.updated.clear()
        api.update(obj_to_update=roots)
        assert recorder.updated == [[widget_id]]


def test_a_change_under_a_skipped_root_is_still_serialized():
    api, recorder, window, widget, actors = scene()
    actors[1].GetProperty().SetOpacity(0.25)
    api.update(obj_to_update=[widget, window])
    assert opacity_in_state(api, actors[1]) == pytest.approx(0.25)


def test_a_root_the_walk_no_longer_reaches_is_walked_after_it():
    api, recorder, window, widget, actors = scene()
    widget.EnabledOff()
    widget.SetInteractor(None)
    actors[1].GetProperty().SetOpacity(0.25)
    recorder.updated.clear()
    api.update(obj_to_update=[window, widget])
    assert recorder.updated == [[recorder.GetId(widget)], [recorder.GetId(window)]]
    assert opacity_in_state(api, actors[1]) == pytest.approx(0.25)


def test_a_root_reached_only_through_an_unwalked_object_is_walked():
    """A root left out because one walk reached it last time, and reached this time
    only through an object no walk of this update serializes, is walked itself."""
    actor = actor_for(vtkSphereSource())
    first, second, shared, other = (vtkAssembly() for _ in range(4))
    second.AddPart(actor)
    shared.AddPart(actor)
    other.AddPart(shared)
    api = ObjectManagerAPI()
    manager = api.vtk_object_manager
    first_id, second_id, actor_id, _ = (
        manager.RegisterObject(o) for o in (first, second, actor, other)
    )
    manager.UpdateStatesFromObjects()
    api.update(obj_to_update=[first, second, actor])
    assert actor_id in manager.GetAllDependencies(second_id)

    second.RemovePart(actor)
    first.AddPart(shared)
    actor.GetProperty().SetOpacity(0.25)
    recorder = RecordingManager(manager)
    api.vtk_object_manager = recorder
    api.update(obj_to_update=[first, second, actor])
    assert recorder.updated == [[first_id, second_id], [actor_id]]
    assert opacity_in_state(api, actor) == pytest.approx(0.25)
    (expected,) = reference_dependencies([actor])
    assert len(manager.GetAllDependencies(actor_id)) == expected


def test_a_skipped_window_still_reports_its_whole_scene():
    api, recorder, window, widget, actors = scene()
    status_ids = {vtk_id for vtk_id, _ in api.get_status(recorder.GetId(window))["ids"]}
    for actor in actors:
        assert recorder.GetId(actor) in status_ids
        assert recorder.GetId(actor.GetProperty()) in status_ids


def test_roots_that_do_not_overlap_are_walked_in_one_call():
    api, recorder, window, widget, _ = scene(attach_widget=False)
    window_id = recorder.GetId(window)
    widget_id = recorder.GetId(widget)
    assert window_id not in recorder.GetAllDependencies(widget_id)

    recorder.updated.clear()
    api.update(obj_to_update=[widget, window])
    assert recorder.updated == [[widget_id, window_id]]


def test_a_repeated_root_is_walked_once():
    api, recorder, window, _, _ = scene(attach_widget=False)
    recorder.updated.clear()
    api.update(obj_to_update=[window, window])
    assert recorder.updated == [[recorder.GetId(window)]]
