"""Offline tests for the WASM download/registration helpers, the download CLI
and the standalone exporter. A local .tgz mocks the release archive so we don't
fetch from network"""

import io
import tarfile
import zipfile

import pytest
from vtkmodules.vtkCommonCore import vtkVersion
from vtkmodules.vtkFiltersSources import vtkConeSource

from trame_vtklocal import wasm as wasm_cli
from trame_vtklocal.module import wasm
from trame_vtklocal.utils import exporter

VERSION = vtkVersion().GetVTKVersion()
REQUIRED_FILES = wasm.get_required_files(VERSION)


def make_archive(path, names=REQUIRED_FILES):
    """Write a .tgz shaped like the release archive (flat ./<file> entries)."""
    with tarfile.open(path, "w:gz") as tgz:
        for name in names:
            data = name.encode()
            info = tarfile.TarInfo(f"./{name}")
            info.size = len(data)
            tgz.addfile(info, io.BytesIO(data))
    return path


@pytest.fixture
def archive(tmp_path):
    return make_archive(tmp_path / "release.tgz")


@pytest.fixture
def local_wasm_info(monkeypatch, archive):
    """Make get_wasm_info point at the local archive instead of gitlab."""
    monkeypatch.setattr(
        wasm, "get_wasm_info", lambda wasm_bits="wasm32": (VERSION, str(archive))
    )
    return archive


@pytest.fixture(autouse=True)
def clean_state(monkeypatch):
    monkeypatch.delenv("VTK_WASM_DIR_OVERRIDE", raising=False)
    wasm.WASM_DOWNLOADING.clear()
    yield
    wasm.WASM_DOWNLOADING.clear()


def populate(directory, names=REQUIRED_FILES):
    directory.mkdir(parents=True, exist_ok=True)
    for name in names:
        directory.joinpath(name).write_text(name)
    return directory


# -----------------------------------------------------------------------------
# trame_vtklocal.module.wasm
# -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    "version,expected",
    [
        ("9.4.0", ["vtkWasmSceneManager.mjs", "vtkWasmSceneManager.wasm"]),
        (
            "9.6.0",
            [
                "abcWebAssembly.mjs",
                "abcWebAssembly.wasm",
                "abcWebAssemblyAsync.mjs",
                "abcWebAssemblyAsync.wasm",
            ],
        ),
        ("9.7.20260716", ["abcWebAssembly.mjs", "abcWebAssembly.wasm"]),
    ],
)
def test_get_required_files(version, expected):
    assert wasm.get_required_files(version, wasm_base_name="abc") == expected


def test_has_required_files(tmp_path):
    assert not wasm.has_required_files(tmp_path, VERSION)
    populate(tmp_path, REQUIRED_FILES[:-1])
    assert not wasm.has_required_files(tmp_path, VERSION)
    populate(tmp_path)
    assert wasm.has_required_files(str(tmp_path), VERSION)


def test_cache_directory_bundled_files_win_over_unwritable(tmp_path, monkeypatch):
    serve = tmp_path / "serve"
    for wasm_bits in ("wasm32", "wasm64"):
        populate(serve / wasm_bits / VERSION)

    def readonly(*args, **kwargs):
        raise PermissionError("read-only")

    monkeypatch.setattr(type(serve), "touch", readonly)
    assert wasm.get_wasm_cache_directory(str(serve)) == str(serve)


def test_cache_directory_writable(tmp_path):
    serve = tmp_path / "serve"
    serve.mkdir()
    assert wasm.get_wasm_cache_directory(str(serve)) == str(serve)
    assert not (serve / "test.write").exists()


def test_cache_directory_falls_back_to_user_cache(tmp_path, monkeypatch):
    # A path below a regular file cannot be written to (NotADirectoryError,
    # an OSError that is not a PermissionError).
    blocker = tmp_path / "blocker"
    blocker.write_text("")
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.setenv("USERPROFILE", str(home))
    monkeypatch.setenv("APPDATA", str(home))

    result = wasm.get_wasm_cache_directory(str(blocker / "serve"))
    assert result == str(
        (home / "vtk-wasm" if wasm.IS_WINDOWS else home / ".vtk-wasm").resolve()
    )


def test_register_wasm_downloads_missing_files(tmp_path, local_wasm_info):
    serve = tmp_path / "serve"
    result = wasm.register_wasm(serve, wasm_bits="wasm32")

    dest = serve / "wasm32" / VERSION
    assert wasm.has_required_files(dest, VERSION)
    assert (dest / "vtk-wasm.tgz").read_bytes() == local_wasm_info.read_bytes()
    assert result["state"]["__trame_vtklocal_wasm32"] == {
        "url": f"__trame_vtklocal_wasm/wasm32/{VERSION}",
        "wasmBaseName": "vtk",
        "tgz_url": f"__trame_vtklocal_wasm/wasm32/{VERSION}/vtk-wasm.tgz",
    }


def test_register_wasm_skips_download_when_present(tmp_path, monkeypatch):
    serve = tmp_path / "serve"
    populate(serve / "wasm64" / VERSION)

    def fail(*args, **kwargs):
        raise AssertionError("should not download")

    monkeypatch.setattr(wasm, "run_async", fail)
    result = wasm.register_wasm(serve, wasm_bits="wasm64")
    assert "tgz_url" not in result["state"]["__trame_vtklocal_wasm64"]


@pytest.mark.parametrize("use_env", [False, True])
def test_register_wasm_dev_directory(tmp_path, monkeypatch, use_env):
    build = tmp_path / "build"
    populate(build / "bin", ["vtkWebAssembly.mjs", "vtkWebAssembly.wasm"])
    populate(build / "other", ["vtkWebAssembly.map", "unrelated.wasm"])

    serve = tmp_path / "serve"
    versioned = populate(serve / "wasm32" / VERSION)
    dev = populate(serve / "dev", ["stale.wasm"])

    if use_env:
        monkeypatch.setenv("VTK_WASM_DIR_OVERRIDE", str(build))
        result = wasm.register_wasm(serve, wasm_bits="wasm32")
    else:
        result = wasm.register_wasm(serve, wasm_bits="wasm32", wasm_dir=str(build))

    assert sorted(p.name for p in dev.iterdir()) == [
        "vtkWebAssembly.mjs",
        "vtkWebAssembly.wasm",
    ]
    # existing versioned files are left untouched
    assert wasm.has_required_files(versioned, VERSION)
    assert result["state"]["__trame_vtklocal_wasm32"] == {
        "url": "__trame_vtklocal_wasm/dev",
        "wasmBaseName": "vtk",
    }


def test_download_wasm(tmp_path, local_wasm_info):
    directory = wasm.download_wasm(tmp_path, wasm_bits="wasm32")
    assert directory == tmp_path / "wasm32" / VERSION
    assert wasm.has_required_files(directory, VERSION)
    assert not wasm.WASM_DOWNLOADING


def test_download_wasm_skips_existing(tmp_path, monkeypatch):
    populate(tmp_path / "wasm32" / VERSION)

    async def fail(*args, **kwargs):
        raise AssertionError("should not download")

    monkeypatch.setattr(wasm, "setup_wasm_directory", fail)
    assert wasm.download_wasm(tmp_path) == tmp_path / "wasm32" / VERSION


def test_download_wasm_force(tmp_path, local_wasm_info):
    directory = populate(tmp_path / "wasm32" / VERSION)
    directory.joinpath(REQUIRED_FILES[0]).write_text("old")
    wasm.download_wasm(tmp_path, force=True)
    assert directory.joinpath(REQUIRED_FILES[0]).read_text() == REQUIRED_FILES[0]
    assert (directory / "vtk-wasm.tgz").exists()


def test_download_wasm_custom_url(tmp_path):
    other = make_archive(tmp_path / "custom.tgz")
    directory = wasm.download_wasm(tmp_path / "dest", wasm_url=other)
    assert (directory / "vtk-wasm.tgz").read_bytes() == other.read_bytes()


def test_download_wasm_failure(tmp_path):
    with pytest.raises(FileNotFoundError):
        wasm.download_wasm(tmp_path / "dest", wasm_url=str(tmp_path / "missing.tgz"))
    # failed futures are consumed and not left behind
    assert not wasm.WASM_DOWNLOADING


# -----------------------------------------------------------------------------
# python -m trame_vtklocal.wasm
# -----------------------------------------------------------------------------


def test_cli_download(tmp_path, archive, capsys):
    dest = tmp_path / "dest"
    args = [
        "download",
        "--dest",
        str(dest),
        "--wasm-bits",
        "wasm64",
        "--url",
        str(archive),
    ]
    assert wasm_cli.main(args) == 0
    assert wasm.has_required_files(dest / "wasm64" / VERSION, VERSION)
    assert f"wasm64: {dest / 'wasm64' / VERSION}" in capsys.readouterr().out


def test_cli_download_defaults(tmp_path, monkeypatch, capsys):
    calls = []

    def fake_download(dest, wasm_bits, wasm_url, force):
        calls.append((dest, wasm_bits, wasm_url, force))
        return f"{dest}/{wasm_bits}"

    monkeypatch.setattr(
        wasm_cli, "get_wasm_cache_directory", lambda path: str(tmp_path)
    )
    monkeypatch.setattr(wasm_cli, "download_wasm", fake_download)

    assert wasm_cli.main(["download", "--force"]) == 0
    assert calls == [
        (str(tmp_path), "wasm32", None, True),
        (str(tmp_path), "wasm64", None, True),
    ]
    out = capsys.readouterr().out
    assert f"wasm32: {tmp_path}/wasm32" in out
    assert f"wasm64: {tmp_path}/wasm64" in out


def test_cli_url_requires_single_arch(capsys):
    with pytest.raises(SystemExit) as e:
        wasm_cli.main(["download", "--url", "file.tgz"])
    assert e.value.code == 2
    assert "--url requires a single --wasm-bits value" in capsys.readouterr().err


def test_cli_requires_command():
    with pytest.raises(SystemExit):
        wasm_cli.main([])


def test_cli_reports_errors(tmp_path, capsys):
    args = [
        "download",
        "--dest",
        str(tmp_path),
        "--wasm-bits",
        "wasm32",
        "--url",
        str(tmp_path / "missing.tgz"),
    ]
    assert wasm_cli.main(args) == 1
    assert capsys.readouterr().err.startswith("Error: ")


# -----------------------------------------------------------------------------
# trame_vtklocal.utils.exporter
# -----------------------------------------------------------------------------


@pytest.fixture
def export_env(tmp_path, monkeypatch, local_wasm_info):
    """Point the exporter at a temporary serve directory and stub viewer assets."""
    serve = tmp_path / "serve"
    serve.mkdir()
    css = tmp_path / "viewer.css"
    css.write_text("/* viewer-css */")
    js = tmp_path / "viewer.umd.js"
    js.write_text("/* viewer-js */")
    monkeypatch.setattr(exporter, "SERVE_PATH", serve)
    monkeypatch.setattr(exporter, "VIEWER_CSS", css)
    monkeypatch.setattr(exporter, "VIEWER_JS", js)
    return serve


def test_get_wasm_archive_release(export_env, local_wasm_info):
    assert exporter.get_wasm_archive("wasm32") == local_wasm_info.read_bytes()


def test_get_wasm_archive_dev_override(tmp_path, export_env, monkeypatch):
    build = populate(tmp_path / "build", ["vtkWebAssembly.mjs", "vtkWebAssembly.wasm"])
    (build / "nested").mkdir()
    monkeypatch.setenv("VTK_WASM_DIR_OVERRIDE", str(build))

    data = exporter.get_wasm_archive("wasm32")
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tgz:
        assert tgz.getnames() == ["./vtkWebAssembly.mjs", "./vtkWebAssembly.wasm"]
        assert tgz.extractfile("./vtkWebAssembly.mjs").read() == b"vtkWebAssembly.mjs"


def test_create_viewer(tmp_path, export_env):
    output = tmp_path / "viewer.html"
    exporter.create_viewer(output)
    html = output.read_text()
    assert "/* viewer-css */" in html
    assert "/* viewer-js */" in html
    assert "wasmURL" in html
    assert 'get("dataURL")' in html
    assert '"mode": "wasm32"' in html


def test_to_html(tmp_path, export_env):
    cone = vtkConeSource()
    cone.Update()
    polydata = cone.GetOutput()

    in_memory = exporter.to_html([polydata], config={"mode": "wasm64"})
    assert b"/* viewer-js */" in in_memory
    assert b"dataURL" in in_memory
    assert b'"mode": "wasm64"' in in_memory

    output = exporter.to_html([polydata], output=tmp_path / "out" / "scene.html")
    assert output.read_bytes().startswith(b"<html>")


def test_to_wazex(tmp_path):
    cone = vtkConeSource()
    cone.Update()

    data = exporter.to_wazex([cone.GetOutput()])
    with zipfile.ZipFile(io.BytesIO(data)) as zipf:
        names = zipf.namelist()
        assert "vtk-wasm.json" in names
        assert any(n.startswith("states/") and n != "states/" for n in names)

    output = exporter.to_wazex([cone.GetOutput()], output=tmp_path / "a" / "b.wazex")
    assert zipfile.is_zipfile(output)

    with pytest.raises(ValueError):
        exporter.to_wazex()
    with pytest.raises(ValueError):
        exporter.to_wazex(root_ids=[1])
