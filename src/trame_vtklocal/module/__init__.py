from pathlib import Path

from trame_vtklocal import __version__
from trame_vtklocal.module.protocol import ObjectManagerHelper
from trame_vtklocal.module.wasm import register_wasm

__all__ = [
    "serve",
    "setup",
    "get_helper",
]

serve_path = str(Path(__file__).with_name("serve").resolve())
serve_directory = f"__trame_vtklocal_{__version__}"

serve = {serve_directory: serve_path}

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

    client_type = "vue2"
    if hasattr(trame_server, "client_type"):
        client_type = trame_server.client_type

    if client_type == "react":
        trame_server.enable_module(
            {
                "scripts": [f"{serve_directory}/js/trame_vtklocal_react.umd.cjs"],
                "styles": [f"{serve_directory}/js/trame_vtklocal_react.css"],
                "react_use": ["trame_vtklocal_react"],
            }
        )
    else:
        trame_server.enable_module(
            {
                "scripts": [f"{serve_directory}/js/trame_vtklocal.umd.js"],
                "styles": [f"{serve_directory}/js/trame_vtklocal.css"],
                "vue_use": ["trame_vtklocal"],
            }
        )
