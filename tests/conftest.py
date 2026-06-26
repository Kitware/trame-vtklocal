from pathlib import Path

import pytest
import vtk
from PIL import Image
from pixelmatch.contrib.PIL import pixelmatch
from trame.app import TrameApp
from trame.decorators import change
from trame.ui.html import DivLayout
from trame_client.utils.testing import FixtureHelper, enable_testing

from trame.widgets import client, html, vtklocal
from trame_vtklocal.utils import ui

ROOT_PATH = Path(__file__).parent.parent.absolute()
HELPER = FixtureHelper(ROOT_PATH)


class Utils:
    @staticmethod
    async def compare_screenshot(page, baseline_image, result_directory, threshold=0.1):
        test_image = result_directory / baseline_image.with_suffix(".png").name
        await page.screenshot(path=test_image)

        img_test = Image.open(test_image)
        img_diff = Image.new("RGBA", img_test.size)
        mismatches = []

        for ref_file in baseline_image.parent.glob(f"{baseline_image.name}*.png"):
            img_ref = Image.open(ref_file)

            file_diff = (test_image.parent / ref_file.name).with_suffix(".diff.png")
            mismatch = pixelmatch(img_ref, img_test, img_diff, threshold=threshold)
            img_diff.save(file_diff)
            file_diff.with_suffix(".txt").write_text(f"{mismatch}")
            mismatches.append(mismatch)

        return min(mismatches) < threshold


def create_vtk_pipeline():
    renderer = vtk.vtkRenderer()
    rw = vtk.vtkRenderWindow()
    rw.AddRenderer(renderer)
    rwi = vtk.vtkRenderWindowInteractor(render_window=rw)
    rwi.interactor_style.SetCurrentStyleToTrackballCamera()

    cone = vtk.vtkConeSource()

    mapper = vtk.vtkPolyDataMapper(input_connection=cone.output_port)
    actor = vtk.vtkActor(mapper=mapper)

    renderer.AddActor(actor)
    renderer.background = (0.1, 0.2, 0.4)
    renderer.ResetCamera()

    return rw, cone


class Cone(TrameApp):
    def __init__(self, server=None, mode="wasm32", exec="sync", rendering="webgl"):
        super().__init__(server)
        self.state.wasm_conf = {
            "mode": mode,
            "exec": exec,
            "rendering": rendering,
        }
        enable_testing(self.server, "local_rendering_ready")
        self.render_window, self.cone = create_vtk_pipeline()
        self._build_ui()

    @property
    def resolution(self):
        return self.state.resolution

    @resolution.setter
    def resolution(self, v):
        with self.state:
            self.state.resolution = int(v)

    @change("resolution")
    def _on_resolution(self, resolution, **_):
        self.cone.resolution = int(resolution)
        self.ctx.view.update()

    @property
    def mounted(self):
        return self.state.mounted

    @mounted.setter
    def mounted(self, v):
        with self.state:
            self.state.mounted = bool(v)

    def _build_ui(self):
        self.state.local_rendering_ready = 0
        with DivLayout(self.server) as self.ui:
            html.Div("{{ local_rendering_ready }}", classes="readyCount")
            client.Style(
                "body { margin: 0; } .readyCount { z-index: 10; position: absolute; left: 0; top: 0; }"
            )
            with html.Div(
                style=ui.FULL_SCREEN,
                v_if=("mounted", True),
            ):
                vtklocal.LocalView(
                    self.render_window,
                    ctx_name="view",
                    config=["wasm_conf"],
                    updated="local_rendering_ready++",
                )


@pytest.fixture
def ref_dir() -> Path:
    return Path(__file__).parent / "refs"


@pytest.fixture
def server(xprocess, server_path):
    name, Starter, Monitor = HELPER.get_xprocess_args(server_path)

    # ensure process is running and return its logfile
    logfile = xprocess.ensure(name, Starter)
    yield Monitor(logfile[1])

    # clean up whole process tree afterwards
    xprocess.getinfo(name).terminate()


@pytest.fixture
def utils():
    return Utils


@pytest.fixture
def ConeApp():
    return Cone
