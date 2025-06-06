import zipfile
import json
from pathlib import Path
from wslink import register as export_rpc
from wslink.websocket import LinkProtocol

# from vtkmodules.vtkCommonCore import vtkLogger
from vtkmodules.vtkSerializationManager import vtkObjectManager
from vtkmodules.vtkCommonCore import vtkVersion

try:
    import zlib  # noqa

    ZIP_COMPRESSION = zipfile.ZIP_DEFLATED
except ImportError:
    ZIP_COMPRESSION = zipfile.ZIP_STORED

VTK_VERSION = vtkVersion()
API_NO_IDS_UPDATE = (
    VTK_VERSION.GetVTKMajorVersion() <= 9
    and VTK_VERSION.GetVTKMinorVersion() <= 4
    and VTK_VERSION.GetVTKBuildVersion() < 20250509
)  # mr90034


def map_id_mtime(object_manager, vtk_id):
    vtk_obj = object_manager.GetObjectAtId(vtk_id)
    if vtk_obj is None:
        return (vtk_id, 0)
    return (vtk_id, vtk_obj.GetMTime())


class ObjectManagerAPI(LinkProtocol):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.vtk_object_manager = vtkObjectManager()
        self.vtk_object_manager.Initialize()
        self._subscriptions = {}
        self._widgets = {}
        self._last_publish_states = {}
        self._last_publish_hash = set()
        self._push_camera = False

        self._debug_state = False
        self._debug_state_counter = 1

        # Debug - adjust verbosity
        # self.vtk_object_manager.SetObjectManagerLogVerbosity(
        #     vtkLogger.VERBOSITY_WARNING
        # )
        # self.vtk_object_manager.serializer.SetSerializerLogVerbosity(
        #     vtkLogger.VERBOSITY_WARNING
        # )

    def register_widget(self, root_obj, dep_obj):
        self.vtk_object_manager.RegisterObject(dep_obj)
        root_id = self.vtk_object_manager.GetId(root_obj)
        dep_id = self.vtk_object_manager.GetId(dep_obj)
        if root_id not in self._widgets:
            self._widgets[root_id] = set()

        self._widgets[root_id].add(dep_id)
        # print(f"Register widget: {dep_obj.GetClassName()}={dep_id}")

    def unregister_widget(self, root_obj, dep_obj):
        self.vtk_object_manager.UnRegisterObject(dep_obj)
        root_id = self.vtk_object_manager.GetId(root_obj)
        dep_id = self.vtk_object_manager.GetId(dep_obj)
        if root_id in self._widgets:
            self._widgets[root_id].discard(dep_id)

    def get_all_ids(self, root_id):
        if root_id in self._widgets:
            return [root_id, *self._widgets[root_id]]
        return [root_id]

    def update(self, push_camera=False, obj_to_update=None, **_):
        self._push_camera = push_camera

        if API_NO_IDS_UPDATE:  # <= 9.4.2
            self.vtk_object_manager.UpdateStatesFromObjects()
        else:  # > 9.4.2
            if obj_to_update is None:
                self.vtk_object_manager.UpdateStatesFromObjects()
            else:
                ids = [
                    self.vtk_object_manager.GetId(vtk_obj) for vtk_obj in obj_to_update
                ]
                self.vtk_object_manager.UpdateStatesFromObjects(ids)

        if self._debug_state:
            self.vtk_object_manager.Export(f"snapshot-{self._debug_state_counter}")
            self._debug_state_counter += 1

        # Handle subscription push
        remove_from_subscriptions = []
        for obj_id, count in self._subscriptions.items():
            if count == 0:
                remove_from_subscriptions.append(obj_id)
            elif count > 0:
                status = self.get_status(obj_id)
                for state_id, mtime in status.get("ids", []):
                    if mtime > self._last_publish_states.get(state_id, 0):
                        self._last_publish_states[state_id] = mtime
                        self.publish(
                            "vtklocal.subscriptions",
                            dict(
                                type="state",
                                id=state_id,
                                mtime=mtime,
                                content=self.get_state(state_id),
                            ),
                        )
                for hash in status.get("hashes", []):
                    if hash not in self._last_publish_hash:
                        self._last_publish_hash.add(hash)
                        self.publish(
                            "vtklocal.subscriptions",
                            dict(type="blob", hash=hash, content=self.get_hash(hash)),
                        )

        for id_to_gc in remove_from_subscriptions:
            self._subscriptions.pop(id_to_gc)

    @property
    def active_ids(self):
        return self.vtk_object_manager.GetAllDependencies("")

    @export_rpc("vtklocal.subscribe.update")
    def update_subscription(self, obj_id, delta):
        if obj_id in self._subscriptions:
            self._subscriptions[obj_id] += delta
        elif delta > 0:
            self._subscriptions[obj_id] = delta

        if delta > 0:
            self._last_publish_states.clear()
            self._last_publish_hash.clear()

        # Keep track of widgets as well
        if obj_id in self._widgets:
            for w_id in self._widgets[obj_id]:
                self.update_subscription(w_id, delta)

    @export_rpc("vtklocal.get.state")
    def get_state(self, obj_id):
        state = self.vtk_object_manager.GetState(obj_id)

        # -------------------------------------------------
        # DEBUG - Helper for dynamic state patching
        # -------------------------------------------------
        # state = json.loads(state)
        # if state["ClassName"] == "vtkTextProperty":
        #     state["FontSize"] *= 2
        # elif state["ClassName"] == "vtkCubeAxesActor":
        #     state["ScreenSize"] *= 2
        # state = json.dumps(state)
        # -------------------------------------------------

        return state

    @export_rpc("vtklocal.get.hash")
    def get_hash(self, hash):
        # print("get_hash", hash)
        return self.addAttachment(memoryview(self.vtk_object_manager.GetBlob(hash)))

    @export_rpc("vtklocal.get.status")
    def get_status(self, obj_id):
        # print("get_status", obj_id)
        ids = self.vtk_object_manager.GetAllDependencies(obj_id)

        # Add widgets ids without duplicate
        ids_width_deps = list(ids)
        if obj_id in self._widgets:
            for dep_id in self._widgets[obj_id]:
                ids_width_deps += list(
                    self.vtk_object_manager.GetAllDependencies(dep_id)
                )
        ids = list(set(ids_width_deps))

        hashes = self.vtk_object_manager.GetBlobHashes(ids)
        renderWindow = self.vtk_object_manager.GetObjectAtId(obj_id)
        ids_mtime = [map_id_mtime(self.vtk_object_manager, v) for v in ids]
        ignore_ids = []
        cameras = []
        force_push = []
        if renderWindow:
            interactor = self.vtk_object_manager.GetId(renderWindow.interactor)
            renderers = renderWindow.GetRenderers()
            for renderer in renderers:
                activeCamera = renderer.GetActiveCamera()
                cid = self.vtk_object_manager.GetId(activeCamera)
                if not self._push_camera:
                    ignore_ids.append(cid)
                else:
                    force_push.append(cid)
                cameras.append(cid)
        return dict(
            ids=ids_mtime,
            hashes=hashes,
            ignore_ids=ignore_ids,
            cameras=cameras,
            force_push=force_push,
            interactor=interactor,
        )

    def dump_data(self, output_file, wasm_ids):
        """
        Create file (zip) with WASM data
        """
        output_file = Path(output_file)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        # Extract ids to save
        all_ids = set()
        for vtk_id in wasm_ids:
            all_ids.update(self.vtk_object_manager.GetAllDependencies(vtk_id))

        # Extract hash to save
        hashes = self.vtk_object_manager.GetBlobHashes(list(all_ids))

        with zipfile.ZipFile(output_file, "w", ZIP_COMPRESSION) as zipf:
            # Write info
            zipf.writestr(
                "vtk-wasm.json",
                json.dumps(
                    {
                        "vtk": VTK_VERSION.GetVTKVersion(),
                        "ids": wasm_ids,
                    }
                ),
            )
            # Write states
            zipf.mkdir("states")
            for vtk_id in all_ids:
                zipf.writestr(
                    f"states/{vtk_id}",
                    self.vtk_object_manager.GetState(vtk_id),
                )

            # Write blobs
            zipf.mkdir("blobs")
            for hash in hashes:
                zipf.writestr(
                    f"blobs/{hash}",
                    memoryview(self.vtk_object_manager.GetBlob(hash)),
                )


class ObjectManagerHelper:
    def __init__(self, trame_server):
        self.trame_server = trame_server
        self.root_protocol = None
        self.api = ObjectManagerAPI()
        self.trame_server.add_protocol_to_configure(self.configure_protocol)

    def configure_protocol(self, protocol):
        self.root_protocol = protocol
        self.root_protocol.registerLinkProtocol(self.api)
