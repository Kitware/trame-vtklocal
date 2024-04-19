import asyncio
import aiohttp
from pathlib import Path
import tarfile


async def download_file(url, filename):
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

    print(f"Downloaded WASM in {dest_folder}")
    Path(dest_file).unlink()


def get_wasm_info():
    from vtkmodules.vtkCommonCore import vtkVersion

    vtk_version = vtkVersion()
    version = vtk_version.GetVTKVersion()
    return (
        version,
        f"https://gitlab.kitware.com/api/v4/projects/13/packages/generic/vtk-wasm/{version}/vtk-wasm.{version}.tar.gz",
    )


def register_wasm(serve_path):
    version, wasm_url = get_wasm_info()
    BASE_URL = f"__trame_vtklocal/wasm/{version}"
    dest_directory = Path(serve_path) / "wasm" / version

    if not dest_directory.exists():
        asyncio.new_event_loop().run_until_complete(
            setup_wasm_directory(dest_directory, wasm_url)
        )

    return dict(
        module_scripts=[f"{BASE_URL}/vtkWasmSceneManager.mjs"],
        state={"__trame_vtklocal_wasm_url": f"{BASE_URL}/vtkWasmSceneManager.wasm"},
    )
