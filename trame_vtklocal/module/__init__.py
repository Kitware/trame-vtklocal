from pathlib import Path
from wslink import register as export_rpc
from wslink.websocket import LinkProtocol
from trame_client.utils.web_module import file_with_digest

from vtkmodules.vtkSerializationManager import vtkObjectManager
import vtk_wasm

__all__ = [
    "serve",
    "scripts",
    "module_scripts",
    "state",
    "vue_use",
    "setup",
    "get_helper",
]

serve_path = str(Path(__file__).with_name("serve").resolve())

serve = {"__trame_vtklocal": serve_path}
state = {}
scripts = ["__trame_vtklocal/js/trame_vtklocal.umd.js"]
vue_use = ["trame_vtklocal"]
module_scripts = []


def register_wasm():
    global serve, module_scripts, state
    BASE_URL = "__trame_vtklocal_wasm"
    wasm_path = Path(vtk_wasm.__file__).parent.resolve()
    serve[BASE_URL] = str(wasm_path)
    for file in wasm_path.glob("vtkWasmSceneManager*"):
        if file.name.rfind("-") != len("vtkWasmSceneManager"):
            continue  # skip digested files

        file = file_with_digest(file, digest_size=6)
        if file.suffix == ".mjs":
            module_scripts.append(f"{BASE_URL}/{file.name}")

        if file.suffix == ".wasm":
            state[f"{BASE_URL}_name"] = file.name


register_wasm()

# -----------------------------------------------------------------------------
# Protocol
# -----------------------------------------------------------------------------


def map_id_mtime(object_manager, vtk_id):
    vtk_obj = object_manager.GetObjectAtId(vtk_id)
    return (vtk_id, vtk_obj.GetMTime())


class ObjectManagerAPI(LinkProtocol):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.vtk_object_manager = vtkObjectManager()
        self.vtk_object_manager.Initialize()
        self._subscriptions = {}
        self._last_publish_states = {}
        self._last_publish_hash = set()

        self._debug_state = False
        self._debug_state_counter = 1

    def update(self):
        self.vtk_object_manager.UpdateStatesFromObjects()
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

    @export_rpc("vtklocal.get.state")
    def get_state(self, obj_id):
        # print(f"get_state {obj_id} {self.vtk_object_manager.GetObjectAtId(obj_id).GetClassName()}")
        state = self.vtk_object_manager.GetState(obj_id)
        return state

    @export_rpc("vtklocal.get.hash")
    def get_hash(self, hash):
        # print("get_hash", hash)
        return self.addAttachment(memoryview(self.vtk_object_manager.GetBlob(hash)))

    @export_rpc("vtklocal.get.status")
    def get_status(self, obj_id):
        # print("get_status", obj_id)
        ids = self.vtk_object_manager.GetAllDependencies(obj_id)
        hashes = self.vtk_object_manager.GetBlobHashes(ids)
        renderWindow = self.vtk_object_manager.GetObjectAtId(obj_id)
        ids_mtime = [map_id_mtime(self.vtk_object_manager, v) for v in ids]
        ignore_ids = []
        if renderWindow:
            renderers = renderWindow.GetRenderers()
            for renderer in renderers:
                activeCamera = renderer.GetActiveCamera()
                ignore_ids.append(self.vtk_object_manager.GetId(activeCamera))
        return dict(ids=ids_mtime, hashes=hashes, ignore_ids=ignore_ids)


# -----------------------------------------------------------------------------
# ObjectManagerHelper
# -----------------------------------------------------------------------------


class ObjectManagerHelper:
    def __init__(self, trame_server):
        self.trame_server = trame_server
        self.root_protocol = None
        self.api = ObjectManagerAPI()
        self.trame_server.add_protocol_to_configure(self.configure_protocol)

    def configure_protocol(self, protocol):
        self.root_protocol = protocol
        self.root_protocol.registerLinkProtocol(self.api)


# -----------------------------------------------------------------------------
# Module advanced initialization
# -----------------------------------------------------------------------------

HELPERS_PER_SERVER = {}


def get_helper(server):
    return HELPERS_PER_SERVER.get(server.name)


def setup(trame_server, **kwargs):
    global HELPERS_PER_SERVER
    HELPERS_PER_SERVER[trame_server.name] = ObjectManagerHelper(trame_server)
