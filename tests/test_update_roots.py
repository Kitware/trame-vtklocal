"""``ObjectManagerAPI.update`` serializes overlapping roots once, and misses nothing."""

import json

import pytest
from vtkmodules.vtkFiltersSources import vtkSphereSource
from vtkmodules.vtkInteractionWidgets import vtkOrientationMarkerWidget
from vtkmodules.vtkRenderingAnnotation import vtkAxesActor
from vtkmodules.vtkRenderingCore import (
    vtkActor,
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


def scene(attach_widget=True):
    window = vtkRenderWindow()
    window.SetOffScreenRendering(1)
    renderer = vtkRenderer()
    window.AddRenderer(renderer)
    interactor = vtkRenderWindowInteractor()
    interactor.SetRenderWindow(window)
    actors = []
    for i in range(3):
        source = vtkSphereSource()
        source.SetCenter(i, 0, 0)
        mapper = vtkPolyDataMapper()
        mapper.SetInputConnection(source.GetOutputPort())
        actor = vtkActor()
        actor.SetMapper(mapper)
        renderer.AddActor(actor)
        actors.append(actor)
    widget = vtkOrientationMarkerWidget()
    widget.SetOrientationMarker(vtkAxesActor())
    if attach_widget:
        widget.SetInteractor(interactor)
        widget.EnabledOn()

    api = ObjectManagerAPI()
    api.vtk_object_manager.RegisterObject(window)
    api.register_widget(window, widget)
    recorder = RecordingManager(api.vtk_object_manager)
    api.vtk_object_manager = recorder
    api.update(obj_to_update=[widget, window])
    return api, recorder, window, widget, actors


def opacity_in_state(api, actor):
    manager = api.vtk_object_manager
    prop_id = manager.GetId(actor.GetProperty())
    return json.loads(manager.GetState(prop_id))["Opacity"]


def test_a_root_inside_another_roots_graph_is_walked_once():
    api, recorder, window, widget, _ = scene()
    window_id = recorder.GetId(window)
    widget_id = recorder.GetId(widget)
    assert window_id in recorder.GetAllDependencies(widget_id)
    assert recorder.updated == [[widget_id]]

    recorder.updated.clear()
    api.update(obj_to_update=[widget, window])
    assert recorder.updated == [[widget_id]]


def test_a_change_under_a_skipped_root_is_still_serialized():
    api, recorder, window, widget, actors = scene()
    actors[1].GetProperty().SetOpacity(0.25)
    api.update(obj_to_update=[widget, window])
    assert opacity_in_state(api, actors[1]) == pytest.approx(0.25)


def test_a_skipped_window_still_reports_its_whole_scene():
    api, recorder, window, widget, actors = scene()
    status_ids = {vtk_id for vtk_id, _ in api.get_status(recorder.GetId(window))["ids"]}
    for actor in actors:
        assert recorder.GetId(actor) in status_ids
        assert recorder.GetId(actor.GetProperty()) in status_ids


def test_roots_that_do_not_overlap_are_each_walked():
    api, recorder, window, widget, _ = scene(attach_widget=False)
    window_id = recorder.GetId(window)
    widget_id = recorder.GetId(widget)
    assert window_id not in recorder.GetAllDependencies(widget_id)

    recorder.updated.clear()
    api.update(obj_to_update=[widget, window])
    assert recorder.updated == [[widget_id], [window_id]]


def test_a_repeated_root_is_walked_once():
    api, recorder, window, _, _ = scene(attach_widget=False)
    recorder.updated.clear()
    api.update(obj_to_update=[window, window])
    assert recorder.updated == [[recorder.GetId(window)]]
