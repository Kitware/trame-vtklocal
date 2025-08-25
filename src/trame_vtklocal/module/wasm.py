import asyncio
import aiohttp
from pathlib import Path
import os
import shutil
import tarfile
from packaging.version import parse


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
                data = await response.read()
                with open(filename, "wb") as f:
                    f.write(data)


async def setup_wasm_directory(target_directory, wasm_url):
    # Need to install wasm
    target_directory.mkdir(parents=True, exist_ok=True)

    dest_file = str((target_directory / "vtk-wasm.tgz").resolve())
    dest_folder = str(target_directory.resolve())

    await download_file(wasm_url, dest_file)

    # unpack
    with tarfile.open(dest_file) as tgz:
        tgz.extractall(dest_folder)

    print(f"Downloaded WASM:\n - from: {wasm_url}\n - to: {dest_folder}")
    Path(dest_file).unlink()


def get_wasm_info():
    from vtkmodules.vtkCommonCore import vtkVersion

    vtk_version = vtkVersion()
    wasm_bits = "wasm32"
    version = vtk_version.GetVTKVersion()
    url = f"https://gitlab.kitware.com/api/v4/projects/13/packages/generic/vtk-{wasm_bits}-emscripten/{version}/vtk-{version}-{wasm_bits}-emscripten.tar.gz"

    return version, url


def register_wasm(serve_path, **kwargs):
    """Register the VTK WebAssembly files in the given serve path.
    Keywords:
        wasm_url: The URL to the VTK WebAssembly files. It is used if wasm_dir is not provided and VTK_WASM_DIR_OVERRIDE
                  is not set. (default: get_wasm_info()[1])
        wasm_base_name: The base name of the VTK WebAssembly files. (default: "vtk")
        wasm_dir: The directory containing the VTK WebAssembly files.
    """
    version, wasm_url = get_wasm_info()
    wasm_base_name = kwargs.get("wasm_base_name", "vtk")
    BASE_URL = f"__trame_vtklocal/wasm/{version}"
    dest_directory = Path(serve_path) / "wasm" / version

    # get wasm directory from kwargs or environment variable
    wasm_dir = kwargs.get("wasm_dir", os.environ.get("VTK_WASM_DIR_OVERRIDE"))
    # if the wasm directory is provided, we copy the files from there
    if wasm_dir and Path(wasm_dir).exists() and Path(wasm_dir).is_dir():
        print(f"Using wasm_dir: {wasm_dir}")
        dest_directory.mkdir(parents=True, exist_ok=True)
        for src_file in Path(wasm_dir).rglob(f"{wasm_base_name}WebAssembly*"):
            shutil.copyfile(
                src_file,
                dest_directory.joinpath(src_file.name),
            )
    else:
        # get wasm version and url
        wasm_url = kwargs.get("wasm_url", wasm_url)

        # if the required wasm files do not exist, we need to download them
        # Versions before 9.5.20250531 use different WASM file naming conventions.
        # this cutoff distinguishes between old and new formats.
        if parse(version) < parse("9.5.20250531"):
            # For older versions, the wasm files are named differently.
            if (
                not dest_directory.joinpath("vtkWasmSceneManager.mjs").exists()
                or not dest_directory.joinpath("vtkWasmSceneManager.wasm").exists()
            ):
                run_async(setup_wasm_directory(dest_directory, wasm_url))
        else:
            if (
                not dest_directory.joinpath(f"{wasm_base_name}WebAssembly.mjs").exists()
                or not dest_directory.joinpath(
                    f"{wasm_base_name}WebAssembly.wasm"
                ).exists()
                or not dest_directory.joinpath(
                    f"{wasm_base_name}WebAssemblyAsync.mjs"
                ).exists()
                or not dest_directory.joinpath(
                    f"{wasm_base_name}WebAssemblyAsync.wasm"
                ).exists()
            ):
                run_async(setup_wasm_directory(dest_directory, wasm_url))

    return dict(
        state={
            "__trame_vtklocal_wasm_url": BASE_URL,
            "__trame_vtklocal_wasm_base_name": wasm_base_name,
        },
    )
