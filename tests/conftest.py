import sys
from pathlib import Path

import pytest
import vtk
from vtkmodules.test import Testing as vtk_testing
from trame.app import TrameApp
from trame.decorators import change
from trame.ui.html import DivLayout
from trame_client.utils.testing import FixtureHelper, enable_testing

from trame.widgets import client, html, vtklocal
from trame_vtklocal.utils import ui

ROOT_PATH = Path(__file__).parent.parent.absolute()
HELPER = FixtureHelper(ROOT_PATH)


def webgpu_args():
    """Chromium flags needed to obtain a working WebGPU adapter, per platform.

    Playwright's bundled Chromium exposes no WebGPU adapter by default, and
    --enable-unsafe-webgpu alone only yields a SwiftShader adapter that renders a
    blank frame on macOS. Selecting the platform's native ANGLE backend gives a
    real adapter VTK can draw with. Apply only for webgpu configs, since the
    angle backend override also shifts webgl pixels.
    """
    backend = {"darwin": "metal", "win32": "d3d11"}.get(sys.platform, "vulkan")
    return [f"--use-angle={backend}", "--enable-unsafe-webgpu"]


class Utils:
    @staticmethod
    async def compare_screenshot(
        page, baseline_image, result_directory, threshold=0.05
    ):
        test_image = result_directory / baseline_image.with_suffix(".png").name
        await page.screenshot(path=test_image)

        reader = vtk.vtkPNGReader(file_name=str(test_image))
        reader.Update()

        # vtkTesting writes the .diff/.valid/error images into VTK_TEMP_DIR
        vtk_testing.VTK_TEMP_DIR = str(result_directory)

        try:
            # src_img must be a vtkAlgorithm (image source), not vtkImageData
            vtk_testing.compareImageWithSavedImage(
                reader,
                str(baseline_image.with_suffix(".png")),
                threshold=threshold,
            )
            return True
        except RuntimeError as e:
            print(e)
            return False


MAPPERS = {
    "FixedPoint": vtk.vtkFixedPointVolumeRayCastMapper,
    "Smart": vtk.vtkSmartVolumeMapper,
    "GPU": vtk.vtkOpenGLGPUVolumeRayCastMapper,
    "RayCast": vtk.vtkGPUVolumeRayCastMapper,
}


class VolumeRendering(TrameApp):
    def __init__(
        self, server=None, mode="wasm32", exec="sync", rendering="webgl", mapper="Smart"
    ):
        super().__init__(server)
        self.state.wasm_conf = {
            "mode": mode,
            "exec": exec,
            "rendering": rendering,
        }
        print(self.state.wasm_conf)
        enable_testing(self.server, "local_volume_rendering_ready")
        self._setup_vtk(mapper)
        self._build_ui()

    def _setup_vtk(self, mapper_type):
        renderer = vtk.vtkRenderer()
        rw = vtk.vtkRenderWindow()
        rw.AddRenderer(renderer)
        rwi = vtk.vtkRenderWindowInteractor(render_window=rw)
        rwi.interactor_style.SetCurrentStyleToTrackballCamera()
        renderer.background = (1, 1, 1)

        pwf = vtk.vtkPiecewiseFunction()
        pwf.AddPoint(20, 0.0)
        pwf.AddPoint(255, 0.2)

        lut = vtk.vtkColorTransferFunction()
        lut.AddRGBPoint(0.0, 0.0, 0.0, 0.0)
        lut.AddRGBPoint(64.0, 1.0, 0.0, 0.0)
        lut.AddRGBPoint(128.0, 0.0, 0.0, 1.0)
        lut.AddRGBPoint(192.0, 0.0, 1.0, 0.0)
        lut.AddRGBPoint(255.0, 0.0, 0.2, 0.0)

        source = vtk.vtkRTAnalyticSource()

        property = vtk.vtkVolumeProperty(color=lut, scalar_opacity=pwf, shade=True)
        property.SetColor(lut)
        property.SetScalarOpacity(pwf)
        property.ShadeOn()
        property.SetScalarOpacityUnitDistance(10)
        property.SetInterpolationTypeToLinear()

        mapper = MAPPERS[mapper_type]()
        source >> mapper

        volume = vtk.vtkVolume(mapper=mapper, property=property)
        renderer.AddVolume(volume)

        cube = vtk.vtkCubeAxesActor()
        cube.SetCamera(renderer.GetActiveCamera())
        cube.SetBounds(source.GetOutput().GetBounds())
        renderer.AddActor(cube)

        renderer.ResetCamera()

        self.render_window = rw
        self.pwf = pwf
        self.lut = lut

    def update_pwf(self):
        self.pwf.RemoveAllPoints()
        self.pwf.AddPoint(20, 0.0)
        self.pwf.AddPoint(150, 1.0)
        self.pwf.AddPoint(255, 0.0)
        self.ctx.view.update()

    @property
    def mounted(self):
        return self.state.mounted

    @mounted.setter
    def mounted(self, v):
        with self.state:
            self.state.mounted = bool(v)

    def _build_ui(self):
        self.state.local_volume_rendering_ready = 0
        with DivLayout(self.server) as self.ui:
            html.Div(
                "{{ local_volume_rendering_ready }}",
                classes="readyCount",
            )
            client.Style(
                "body { margin: 0; } .readyCount { z-index: 10; position: absolute; left: -100px; top: 0; }"
            )
            with html.Div(
                style=ui.FULL_SCREEN,
                v_if=("mounted", True),
            ):
                vtklocal.LocalView(
                    self.render_window,
                    ctx_name="view",
                    config=["wasm_conf"],
                    updated="local_volume_rendering_ready++",
                )


class Cone(TrameApp):
    def __init__(self, server=None, mode="wasm32", exec="sync", rendering="webgl"):
        super().__init__(server)
        self.state.wasm_conf = {
            "mode": mode,
            "exec": exec,
            "rendering": rendering,
        }
        enable_testing(self.server, "local_rendering_ready")
        self._setup_vtk()
        self._build_ui()

    def _setup_vtk(self):
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

        self.render_window = rw
        self.cone = cone

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


class MultiView(TrameApp):
    """Two LocalViews sharing one WASM session (issues/76 and issues/77).

    Regression check: with a shared session, an update targeting one view must
    not blank the other. A blacked-out half exceeds the screenshot threshold.
    """

    HALF = "width:50vw; height:100vh; display:inline-block; vertical-align:top;"

    def __init__(self, server=None):
        super().__init__(server)
        enable_testing(self.server, "local_rendering_ready")
        self.render_window_1 = self._create_pipeline(
            vtk.vtkConeSource(), (0.1, 0.2, 0.4)
        )
        self.render_window_2 = self._create_pipeline(
            vtk.vtkSphereSource(), (0.4, 0.2, 0.1)
        )
        self._build_ui()

    @staticmethod
    def _create_pipeline(source, background):
        renderer = vtk.vtkRenderer()
        rw = vtk.vtkRenderWindow()
        rw.AddRenderer(renderer)
        rwi = vtk.vtkRenderWindowInteractor(render_window=rw)
        rwi.interactor_style.SetCurrentStyleToTrackballCamera()

        mapper = vtk.vtkPolyDataMapper(input_connection=source.output_port)
        actor = vtk.vtkActor(mapper=mapper)

        renderer.AddActor(actor)
        renderer.background = background
        renderer.ResetCamera()

        return rw

    def _build_ui(self):
        # Each view bumps the counter once when it first finishes updating, so
        # the test waits for it to reach 2 (both views rendered).
        self.state.local_rendering_ready = 0
        with DivLayout(self.server) as self.ui:
            html.Div("{{ local_rendering_ready }}", classes="readyCount")
            client.Style(
                "body { margin: 0; } .readyCount { z-index: 10; position: absolute; left: 0; top: 0; }"
            )
            with html.Div(style=self.HALF):
                vtklocal.LocalView(
                    self.render_window_1, updated="local_rendering_ready++"
                )
            with html.Div(style=self.HALF):
                vtklocal.LocalView(
                    self.render_window_2, updated="local_rendering_ready++"
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


@pytest.fixture
def MultiViewApp():
    return MultiView


@pytest.fixture
def VolumeApp():
    return VolumeRendering
