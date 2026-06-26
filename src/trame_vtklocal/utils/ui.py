from trame.widgets import html

from .cli import add_wasm_config

FULL_SCREEN = """
    position: absolute;
    left: 0;
    top: 0;
    width: 100vw;
    height: 100vh;
"""

TOOLBAR = """
    position: absolute;
    left: 1rem;
    right: 1rem;
    top: 1rem;
    display: flex;
    padding: 10px;
    background: white;
    gap: 15px;
    border-radius: 5px;
"""


class Toolbar(html.Div):
    def __init__(self):
        super().__init__(style=TOOLBAR)


class Separator(html.Div):
    def __init__(self):
        super().__init__(style="flex:1;")


class Element(html.Div):
    def __init__(self, title):
        super().__init__(style="display:flex;align-items:center")
        with self:
            html.Div(title)


class WasmConfig(html.Div):
    def __init__(self):
        super().__init__(style="display:flex;align-items:center;gap:5px;")

        args = add_wasm_config(self.server.cli)
        self.state.wasm_mode = args.wasm_mode
        self.state.wasm_exec = args.wasm_exec
        self.state.wasm_rendering = args.wasm_rendering

        with self:
            with html.Select(v_model="wasm_mode"):
                html.Option("wasm32")
                html.Option("wasm64")

            with html.Select(v_model="wasm_exec"):
                html.Option("sync")
                html.Option("async")

            with html.Select(v_model="wasm_rendering"):
                html.Option("webgl")
                html.Option("webgpu")
