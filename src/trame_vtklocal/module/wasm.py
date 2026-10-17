import asyncio
import os
import shutil
import tarfile
from pathlib import Path
import platform
import contextlib

import aiohttp
from packaging.version import parse

CURRENT_OS = platform.system()
IS_WINDOWS = CURRENT_OS == "Windows"
WASM_DOWNLOADING = []


async def wasm_downloaded():
    while WASM_DOWNLOADING:
        await WASM_DOWNLOADING.pop()


def run_async(coroutine):
    try:
        loop = asyncio.get_running_loop()
        if loop.is_running():
            loop.create_task(coroutine)
        else:
            loop.run_until_complete(coroutine)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        loop.run_until_complete(coroutine)


async def download_file(url, filename):
    if isinstance(url, Path) or Path(url).exists():
        # just copy the file if it is a local file
        shutil.copyfile(url, filename)
    elif url.startswith("http://") or url.startswith("https://"):
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                response.raise_for_status()
                data = await response.read()
                with open(filename, "wb") as f:
                    f.write(data)


async def setup_wasm_directory(target_directory, wasm_url):
    # Need to install wasm
    target_directory.mkdir(parents=True, exist_ok=True)

    dest_file = str((target_directory / "vtk-wasm.tgz").resolve())
    dest_folder = str(target_directory.resolve())

    loop = asyncio.get_running_loop()
    future = loop.create_future()
    WASM_DOWNLOADING.append(future)
    try:
        await download_file(wasm_url, dest_file)

        # unpack
        with tarfile.open(dest_file) as tgz:
            if hasattr(tarfile, "data_filter"):
                tgz.extractall(dest_folder, filter="data")
            else:
                tgz.extractall(dest_folder)

        print(f"Downloaded WASM:\n - from: {wasm_url}\n - to: {dest_folder}")

        # Keep tgz so it can be served compressed
        # Path(dest_file).unlink()
    except BaseException as e:
        # Propagate the failure to anyone awaiting wasm_downloaded(); without
        # this the future never resolves and callers hang forever (e.g. when
        # the wasm archive for the installed VTK version is not published yet).
        future.set_exception(e)
        raise
    else:
        future.set_result(str(target_directory))


def get_wasm_info(wasm_bits="wasm32"):
    from vtkmodules.vtkCommonCore import vtkVersion

    vtk_version = vtkVersion()
    version = vtk_version.GetVTKVersion()
    url = f"https://gitlab.kitware.com/api/v4/projects/13/packages/generic/vtk-{wasm_bits}-emscripten/{version}/vtk-{version}-{wasm_bits}-emscripten.tar.gz"

    return version, url


def get_required_files(version, wasm_base_name="vtk"):
    # The archive contents changed over time; these cutoffs distinguish the formats:
    # - before 9.5.20250531: vtkWasmSceneManager.{mjs,wasm}
    # - before 9.7.20260716: separate webgl ({base}WebAssembly.{mjs,wasm}) and
    #   webgpu ({base}WebAssemblyAsync.{mjs,wasm}) builds
    # - from 9.7.20260716: single {base}WebAssembly.{mjs,wasm} build with both
    #   webgl and webgpu support
    if parse(version) < parse("9.5.20250531"):
        return [
            "vtkWasmSceneManager.mjs",
            "vtkWasmSceneManager.wasm",
        ]
    if parse(version) < parse("9.7.20260716"):
        return [
            f"{wasm_base_name}WebAssembly.mjs",
            f"{wasm_base_name}WebAssembly.wasm",
            f"{wasm_base_name}WebAssemblyAsync.mjs",
            f"{wasm_base_name}WebAssemblyAsync.wasm",
        ]
    return [
        f"{wasm_base_name}WebAssembly.mjs",
        f"{wasm_base_name}WebAssembly.wasm",
    ]


def has_required_files(directory, version, wasm_base_name="vtk"):
    directory = Path(directory)
    return all(
        directory.joinpath(f).exists()
        for f in get_required_files(version, wasm_base_name)
    )


def get_wasm_cache_directory(serve_path, wasm_bits_list=("wasm32", "wasm64")):
    default_path = Path(serve_path)

    # If the files were bundled ahead of time (e.g. at image build time), use
    # them even when serve_path is read-only. Both architectures are required by
    # default because setup() registers both and would otherwise try to
    # download the missing one into serve_path.
    from vtkmodules.vtkCommonCore import vtkVersion

    version = vtkVersion().GetVTKVersion()
    if all(
        has_required_files(default_path / wasm_bits / version, version)
        for wasm_bits in wasm_bits_list
    ):
        return serve_path

    # If we can write in Python env, let's use it
    with contextlib.suppress(PermissionError, OSError):
        test_file = default_path / "test.write"
        test_file.unlink(missing_ok=True)
        test_file.touch()
        test_file.unlink(missing_ok=True)
        return serve_path

    # We need to find a directory where user can write
    cache_dir = (
        Path(os.environ.get("APPDATA")) / "vtk-wasm"
        if IS_WINDOWS
        else Path("~/.vtk-wasm").expanduser()
    )
    cache_dir.mkdir(parents=True, exist_ok=True)
    return str(cache_dir.resolve())


def register_wasm(serve_path, wasm_bits="wasm32", **kwargs):
    """Register the VTK WebAssembly files in the given serve path.
    Keywords:
        wasm_url: The URL to the VTK WebAssembly files. It is used if wasm_dir is not provided and VTK_WASM_DIR_OVERRIDE
                  is not set. (default: get_wasm_info()[1])
        wasm_base_name: The base name of the VTK WebAssembly files. (default: "vtk")
        wasm_dir: The directory containing the VTK WebAssembly files.
    """
    version, wasm_url = get_wasm_info(wasm_bits)
    wasm_base_name = kwargs.get("wasm_base_name", "vtk")
    BASE_URL = f"__trame_vtklocal_wasm/{wasm_bits}/{version}"
    dest_directory = Path(serve_path) / wasm_bits / version

    # get wasm directory from kwargs or environment variable
    wasm_dir = kwargs.get("wasm_dir", os.environ.get("VTK_WASM_DIR_OVERRIDE"))
    # if the wasm directory is provided, we copy the files from there
    # into separate "dev" directory. Leaves existing versioned dirs untouched.
    if wasm_dir and Path(wasm_dir).exists() and Path(wasm_dir).is_dir():
        print(f"Using wasm_dir: {wasm_dir}")
        BASE_URL = "__trame_vtklocal_wasm/dev"
        dest_directory = Path(serve_path) / "dev"
        # start clean so nothing from a previous build is served
        shutil.rmtree(dest_directory, ignore_errors=True)
        dest_directory.mkdir(parents=True, exist_ok=True)
        for src_file in Path(wasm_dir).rglob(f"{wasm_base_name}WebAssembly*"):
            if src_file.suffix not in (".mjs", ".wasm"):
                continue
            shutil.copyfile(
                src_file,
                dest_directory.joinpath(src_file.name),
            )
    else:
        # get wasm version and url
        wasm_url = kwargs.get("wasm_url", wasm_url)

        # if the required wasm files do not exist, we need to download them
        if not has_required_files(dest_directory, version, wasm_base_name):
            run_async(setup_wasm_directory(dest_directory, wasm_url))

    # If tgz file available provide url
    add_on = {}
    tgz_file = dest_directory / "vtk-wasm.tgz"
    if tgz_file.exists():
        add_on["tgz_url"] = f"{BASE_URL}/vtk-wasm.tgz"

    return dict(
        state={
            f"__trame_vtklocal_{wasm_bits}": {
                "url": BASE_URL,
                "wasmBaseName": wasm_base_name,
                **add_on,
            }
        },
    )


def download_wasm(dest, wasm_bits="wasm32", wasm_url=None, force=False):
    """Download and unpack the VTK WebAssembly files for the installed VTK
    version into dest/<wasm_bits>/<version>. Blocks until done.
    Returns the directory containing the files."""
    version, default_url = get_wasm_info(wasm_bits)
    dest_directory = Path(dest) / wasm_bits / version
    if force or not has_required_files(dest_directory, version):
        try:
            asyncio.run(setup_wasm_directory(dest_directory, wasm_url or default_url))
        finally:
            # No one awaits these futures outside a server; mark any failure as
            # retrieved since it is already raised here.
            while WASM_DOWNLOADING:
                future = WASM_DOWNLOADING.pop()
                if future.done() and not future.cancelled():
                    future.exception()
    return dest_directory
