import asyncio
import aiohttp
from pathlib import Path
import tarfile


async def download_file(urls, filename):
    async with aiohttp.ClientSession() as session:
        success = True
        for url in urls:
            async with session.get(url) as response:
                data = await response.read()
                if response.status == 404:
                    success = False
                else:
                    with open(filename, "wb") as f:
                        f.write(data)
                        success = True
                    break
        if not success:
            raise Exception("Invalid URLs " + ",".join(urls) + ". Got 404 response.")


async def setup_wasm_directory(target_directory, wasm_urls):
    # Need to install wasm
    target_directory.mkdir(parents=True, exist_ok=True)

    dest_file = str((target_directory / "vtk-wasm.tgz").resolve())
    dest_folder = str(target_directory.resolve())
    await download_file(wasm_urls, dest_file)

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
        (
            # for development, start a http server in directory that has the tarball.
            f"http://localhost:8000/vtk-wasm.{version}.tar.gz",
            f"https://gitlab.kitware.com/api/v4/projects/13/packages/generic/vtk-wasm/{version}/vtk-wasm.{version}.tar.gz",
        ),
    )


def register_wasm(serve_path):
    version, wasm_urls = get_wasm_info()
    BASE_URL = f"__trame_vtklocal/wasm/{version}"
    dest_directory = Path(serve_path) / "wasm" / version

    if not dest_directory.exists():
        asyncio.new_event_loop().run_until_complete(
            setup_wasm_directory(dest_directory, wasm_urls)
        )

    return dict(
        module_scripts=[f"{BASE_URL}/vtkWasmSceneManager.mjs"],
        state={"__trame_vtklocal_wasm_url": f"{BASE_URL}/vtkWasmSceneManager.wasm"},
    )
