import base64
from io import BytesIO
from pathlib import Path
import zipfile
import json
from vtkmodules.vtkSerializationManager import vtkObjectManager
from vtkmodules.vtkCommonCore import vtkVersion
from trame_vtklocal.module import wasm

try:
    import zlib  # noqa

    ZIP_COMPRESSION = zipfile.ZIP_DEFLATED
except ImportError:
    ZIP_COMPRESSION = zipfile.ZIP_STORED

VTK_VERSION = vtkVersion()
UTF8 = "utf-8"

SERVE_PATH = Path(__file__).parent.parent / "module/serve"
VIEWER_BASE = SERVE_PATH / "viewer"
VIEWER_CSS = VIEWER_BASE / "viewer.css"
VIEWER_JS = VIEWER_BASE / "viewer.umd.js"

DEFAULT_CONFIG = {
    "rendering": "webgl",  # webgpu
    "exec": "sync",  # async
    "mode": "wasm32",  # wasm64
}

__all__ = [
    "to_wazex",
    "to_html",
    "create_viewer",
]


def find_wasm(wasm_bits):
    wasm_serve_path = wasm.get_wasm_cache_directory(SERVE_PATH)
    info = wasm.register_wasm(wasm_serve_path, wasm_bits=wasm_bits)
    url = info["state"][f"__trame_vtklocal_{wasm_bits}"]["tgz_url"]
    paths = url.split("/")
    wasmFile = wasm_serve_path / "/".join(paths[1:])
    return wasmFile


def to_url(bytes, prefix):
    return f"""
        const {prefix}Base64 = `{base64.b64encode(bytes).decode("ascii")}`;
        const {prefix}Bytes = Uint8Array.fromBase64({prefix}Base64);
        const {prefix}Blob = new Blob([{prefix}Bytes], {{ type: 'application/gzip' }});
        const {prefix}URL = URL.createObjectURL({prefix}Blob);
    """.encode(UTF8)


def write_html(stream, data, config):
    wasm_file = find_wasm(config.get("mode", "wasm32"))

    stream.write("<html>".encode(UTF8))
    stream.write("\n<head>".encode(UTF8))
    stream.write("\n<style>".encode(UTF8))
    stream.write(VIEWER_CSS.read_bytes())
    stream.write("</style>".encode(UTF8))
    stream.write("\n<script>".encode(UTF8))
    stream.write(VIEWER_JS.read_bytes())
    stream.write("</script>".encode(UTF8))
    stream.write("\n</head>".encode(UTF8))
    stream.write("\n<body>".encode(UTF8))
    stream.write("""\n<div id="viewer"></div>""".encode(UTF8))
    stream.write("\n<script>".encode(UTF8))
    stream.write(to_url(wasm_file.read_bytes(), "wasm"))
    stream.write(to_url(data, "data"))
    stream.write(
        f"""
        vtkWASMViewer.createViewerAsync(
            "#viewer",
            dataURL,
            wasmURL,
            {json.dumps(config)}
        )
    """.encode(UTF8)
    )
    stream.write("</script>".encode(UTF8))
    stream.write("\n</body>".encode(UTF8))
    stream.write("</html>".encode(UTF8))


def create_viewer(output_file, config=None):
    """
    Write a standalone WASM viewer HTML page that does NOT embed any data.

    Unlike `to_html`, which bakes the serialized scene directly into the
    page, this page reads its data at load time from a `dataURL` query
    parameter. This is useful for hosting a single viewer and pointing it
    at different `.wazex` files (see `to_wazex`) without regenerating the
    HTML each time.

    To use it, open `<output_file>?dataURL=<url-to-a-.wazex-file>` in a
    browser.

    Args:
        output_file: Path of the HTML file to write.
        config: Viewer configuration dict, forwarded as-is to
            `vtkWASMViewer.createViewerAsync` on the JS side. Recognized
            keys (see `DEFAULT_CONFIG`):
              - "rendering": "webgl" or "webgpu".
              - "exec": "sync" or "async".
              - "mode": "wasm32" or "wasm64" — selects which WASM build
                gets bundled into the page.
            Defaults to `DEFAULT_CONFIG` when not provided.
    """
    output_file = Path(output_file)
    if config is None:
        config = DEFAULT_CONFIG

    with output_file.open("wb") as stream:
        wasm_file = find_wasm(config.get("mode", "wasm32"))

        stream.write("<html>".encode(UTF8))
        stream.write("\n<head>".encode(UTF8))
        stream.write("\n<style>".encode(UTF8))
        stream.write(VIEWER_CSS.read_bytes())
        stream.write("</style>".encode(UTF8))
        stream.write("\n<script>".encode(UTF8))
        stream.write(VIEWER_JS.read_bytes())
        stream.write("</script>".encode(UTF8))
        stream.write("\n</head>".encode(UTF8))
        stream.write("\n<body>".encode(UTF8))
        stream.write("""\n<div id="viewer"></div>""".encode(UTF8))
        stream.write("\n<script>".encode(UTF8))
        stream.write(to_url(wasm_file.read_bytes(), "wasm"))

        # Extract dataURL from URL
        stream.write(
            """
            const dataURL = new URLSearchParams(window.location.search).get("dataURL");
        """.encode(UTF8)
        )

        stream.write(
            f"""
            vtkWASMViewer.createViewerAsync(
                "#viewer",
                dataURL,
                wasmURL,
                {json.dumps(config)}
            )
        """.encode(UTF8)
        )
        stream.write("</script>".encode(UTF8))
        stream.write("\n</body>".encode(UTF8))
        stream.write("</html>".encode(UTF8))


def to_html(
    vtk_objects=None,
    output=None,
    object_manager=None,
    addon_serdes_registrars=None,
    root_ids=None,
    config=None,
):
    """
    Generate a standalone, self-contained HTML viewer with the serialized
    VTK scene embedded inline (base64), so the resulting file can be
    opened directly in a browser without a server or a separate data file.

    Internally, this serializes `vtk_objects`/`root_ids` via `to_wazex`,
    then bundles that data together with the viewer JS/CSS and the WASM
    runtime matching the current VTK version.

    Args:
        vtk_objects: Root VTK objects to export (e.g. a
            `vtkRenderWindow`). See `to_wazex` for details; forwarded
            as-is.
        output: Destination path for the HTML file, or None to return an
            in-memory `BytesIO` instead of writing to disk.
        object_manager: Existing `vtkObjectManager` to reuse. See
            `to_wazex`; forwarded as-is.
        addon_serdes_registrars: Extension-module handlers needed to
            (de)serialize custom/addon VTK classes. See `to_wazex`;
            forwarded as-is.
        root_ids: Ids of objects already registered/serialized in
            `object_manager` to export, instead of registering
            `vtk_objects`. See `to_wazex`; forwarded as-is.
        config: Viewer configuration dict, see `create_viewer`. Defaults
            to `DEFAULT_CONFIG` when not provided.

    Returns:
        The `output` Path if one was given, otherwise a `BytesIO`
        positioned at the start of the HTML content.
    """
    if config is None:
        config = DEFAULT_CONFIG

    data = to_wazex(
        vtk_objects=vtk_objects,
        object_manager=object_manager,
        addon_serdes_registrars=addon_serdes_registrars,
        root_ids=root_ids,
    )

    if output is None:
        output = BytesIO()
        write_html(output, data, config)
        output.seek(0)
        output = output.getvalue()
    else:
        output = Path(output)
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("wb") as f:
            write_html(f, data, config)

    return output


def to_wazex(
    vtk_objects=None,
    output=None,
    object_manager=None,
    addon_serdes_registrars=None,
    root_ids=None,
):
    """
    Serialize one or more VTK objects into a `.wazex` archive (a zip file)
    that the JS viewer (`to_html`/`create_viewer`) can load.

    There are two ways to select what gets exported:
      - Pass `vtk_objects`: each object is registered on a (possibly
        newly-created) `object_manager`. If one of them is a
        `vtkRenderWindow`, it is `Render()`-ed first so its state
        reflects the current scene, then `UpdateStatesFromObjects()` is
        called to capture the state of everything that was registered.
      - Pass `root_ids` together with an already-populated
        `object_manager` (i.e. objects already registered and
        `UpdateStatesFromObjects()` already called elsewhere, e.g. by a
        live trame session) to export a subset of objects without
        re-registering or re-rendering anything.

    The resulting archive contains:
      - `vtk-wasm.json`: the VTK version used to serialize, and the list
        of root object ids.
      - `states/<id>`: the serialized JSON state of every object that the
        roots transitively depend on.
      - `blobs/<hash>`: the binary payloads (point/array data, textures,
        ...) referenced by those states.

    Args:
        vtk_objects: Root VTK objects to register and export (e.g. a
            `vtkRenderWindow`). Ignored when `root_ids` is provided.
        output: Destination path for the `.wazex` file, or None to
            return an in-memory `BytesIO` instead of writing to disk.
        object_manager: `vtkObjectManager` to use. If None, a new one is
            created and initialized, registering any
            `addon_serdes_registrars` on it. When `root_ids` is
            provided, this must be given and already contain the
            up-to-date state for those ids.
        addon_serdes_registrars: List of extension-module handler
            callables (e.g. generated `RegisterClasses_*` functions) used
            to teach a newly-created `object_manager` how to
            (de)serialize custom/addon VTK classes that aren't part of
            core VTK. Only used when `object_manager` is None.
        root_ids: Ids of objects already registered in `object_manager`
            to export, instead of registering `vtk_objects`. Requires
            `object_manager` to be provided.

    Returns:
        The `output` Path if one was given, otherwise a `BytesIO`
        positioned at the start of the zip content.

    Raises:
        ValueError: If `root_ids` is given without `object_manager`, or
            if neither `vtk_objects` nor `root_ids` is provided.
    """
    if object_manager is None and root_ids:
        raise ValueError(
            "When root_ids are provided, we expect a pre-filled object_manager"
        )

    if vtk_objects is None and root_ids is None:
        raise ValueError("Either vtk_objects or root_ids needs to be provided")

    if addon_serdes_registrars is None:
        addon_serdes_registrars = []

    if object_manager is None:
        object_manager = vtkObjectManager()
        object_manager.Initialize()
        for registrar in addon_serdes_registrars:
            object_manager.InitializeExtensionModuleHandler(registrar)

    if output is None:
        output = BytesIO()
    else:
        output = Path(output)
        output.parent.mkdir(parents=True, exist_ok=True)

    # Convert vtkObjects to root_ids
    if root_ids is None:
        render_window = None
        root_ids = []
        for vtk_object in vtk_objects:
            root_ids.append(object_manager.RegisterObject(vtk_object))
            if vtk_object.IsA("vtkRenderWindow"):
                render_window = vtk_object

        if render_window:
            render_window.Render()

        object_manager.UpdateStatesFromObjects()

    # Gather all ids to export
    ids_to_export = set()
    for root_id in root_ids:
        ids_to_export.update(object_manager.GetAllDependencies(root_id))

    # Gather all hashes to export
    hashes = object_manager.GetBlobHashes(list(ids_to_export))

    # Generate ZIP
    with zipfile.ZipFile(output, "w", ZIP_COMPRESSION) as zipf:
        # Write info
        zipf.writestr(
            "vtk-wasm.json",
            json.dumps(
                {
                    "vtk": VTK_VERSION.GetVTKVersion(),
                    "ids": root_ids,
                }
            ),
        )
        # Write states
        zipf.writestr("states/", "")
        for vtk_id in ids_to_export:
            zipf.writestr(
                f"states/{vtk_id}",
                object_manager.GetState(vtk_id),
            )

        # Write blobs
        zipf.writestr("blobs/", "")
        for hash in hashes:
            zipf.writestr(
                f"blobs/{hash}",
                memoryview(object_manager.GetBlob(hash)),
            )

    if isinstance(output, BytesIO):
        return output.getvalue()

    return output
