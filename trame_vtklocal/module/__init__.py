from pathlib import Path
from trame_vtklocal.module.wasm import register_wasm
from trame_vtklocal.module.protocol import ObjectManagerHelper

__all__ = [
    "serve",
    "scripts",
    "vue_use",
    "setup",
    "get_helper",
]

serve_path = str(Path(__file__).with_name("serve").resolve())

serve = {"__trame_vtklocal": serve_path}
scripts = ["__trame_vtklocal/js/trame_vtklocal.umd.js"]
vue_use = ["trame_vtklocal"]

# -----------------------------------------------------------------------------
# Module advanced initialization
# -----------------------------------------------------------------------------

HELPERS_PER_SERVER = {}


def get_helper(server):
    return HELPERS_PER_SERVER.get(server.name)


def setup(trame_server, **kwargs):
    global HELPERS_PER_SERVER
    HELPERS_PER_SERVER[trame_server.name] = ObjectManagerHelper(trame_server)
    trame_server.enable_module(
        register_wasm(serve_path, trame_server.http_headers.shared_array_buffer)
    )
