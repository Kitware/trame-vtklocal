from pathlib import Path
from wslink import register as export_rpc
from wslink.websocket import LinkProtocol

from vtkmodules.vtkMarshallingManager import vtkObjectManager

__all__ = [
    "serve",
    "scripts",
    "vue_use",
    "setup",
    "get_helper",
]

serve_path = str(Path(__file__).with_name("serve").resolve())
serve = {"__trame_vtklocal": serve_path}
scripts = ["__trame_vtklocal/trame_vtklocal.umd.js"]
vue_use = ["trame_vtklocal"]


# -----------------------------------------------------------------------------
# Protocol
# -----------------------------------------------------------------------------


def extract_ids(object_manager, id_list, id_to_explore):
    if id_to_explore in id_list:
        return id_list

    id_list.append(id_to_explore)
    for child_id in object_manager.GetDirectDependencies(id_to_explore):
        extract_ids(object_manager, id_list, child_id)
    return id_list


def map_id_mtime(object_manager, vtk_id):
    vtk_obj = object_manager.GetObjectWithId(vtk_id)
    return (vtk_id, vtk_obj.GetMTime())


class ObjectManagerAPI(LinkProtocol):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.vtk_object_manager = vtkObjectManager()
        self.vtk_object_manager.Initialize()

    @export_rpc("vtklocal.get.state")
    def get_state(self, obj_id):
        # print("get_state", obj_id)
        state = self.vtk_object_manager.GetState(obj_id)
        # print(state)
        return state

    @export_rpc("vtklocal.get.hash")
    def get_hash(self, hash):
        # print("get_hash", hash)
        return self.addAttachment(memoryview(self.vtk_object_manager.GetBlob(hash)))

    @export_rpc("vtklocal.get.status")
    def get_status(self, obj_id):
        # print("get_status", obj_id)
        ids = extract_ids(self.vtk_object_manager, [], obj_id)
        hashes = list(self.vtk_object_manager.GetBlobHashes(ids))
        return dict(
            ids=[map_id_mtime(self.vtk_object_manager, v) for v in ids],
            hashes=hashes,
            mtime=self.vtk_object_manager.GetLatestMTimeFromObjects(),
        )


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
