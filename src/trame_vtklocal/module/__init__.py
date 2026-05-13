from pathlib import Path

from trame_vtklocal import __version__
from trame_vtklocal.module.protocol import ObjectManagerHelper
from trame_vtklocal.module.wasm import register_wasm

__all__ = [
    "serve",
    "scripts",
    "vue_use",
    "setup",
    "get_helper",
]

serve_path = str(Path(__file__).with_name("serve").resolve())

serve = {f"__trame_vtklocal_{__version__}": serve_path}
scripts = [f"__trame_vtklocal_{__version__}/js/trame_vtklocal.umd.js"]
styles = [f"__trame_vtklocal_{__version__}/js/trame_vtklocal.css"]
vue_use = ["trame_vtklocal"]

# -----------------------------------------------------------------------------
# Module advanced initialization
# -----------------------------------------------------------------------------

HELPERS_PER_SERVER = {}


def get_helper(server):
    return HELPERS_PER_SERVER.get(server.name)


def setup(trame_server, **kwargs):
    global HELPERS_PER_SERVER
    HELPERS_PER_SERVER[trame_server.name] = ObjectManagerHelper(
        trame_server, addon_serdes_registrars=kwargs.pop("addon_serdes_registrars", [])
    )
    trame_server.enable_module(register_wasm(serve_path, wasm_bits="wasm64", **kwargs))
    trame_server.enable_module(register_wasm(serve_path, wasm_bits="wasm32", **kwargs))
