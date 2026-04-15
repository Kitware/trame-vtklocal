from pathlib import Path

import pytest
import vtk
from playwright.async_api import async_playwright, expect

from trame_vtklocal.module.protocol import ObjectManagerAPI
from trame_vtklocal.module.wasm import wasm_downloaded

from conftest import chromium_launch

BASELINES = [
    Path(__file__).with_name("assets") / "partial_update" / name
    for name in [
        "00_startup",
        "01_client_camera_and_hover",
        "02_subset_replace_mapper",
        "03_full_update",
        "04_subset_again",
        "05_second_view_update",
    ]
]

HOVER_COLOR = [1.0, 0.0, 1.0]


class BatchStats:
    """Count what ``vtklocal.get.batch`` ships to the client.

    wslink looks RPC handlers up on the class, so the wrapper has to be
    installed on ``ObjectManagerAPI`` before the server starts.
    """

    def __init__(self):
        self.states = 0
        self.blob_bytes = 0
        self._original = ObjectManagerAPI.get_batch

    def install(self):
        stats = self
        original = self._original

        def get_batch(api, state_ids, hash_keys):
            result = original(api, state_ids, hash_keys)
            # print("====================================================")
            # for state in result['states']:
            #     print(state.get('ClassName'))
            # print("====================================================")
            stats.states += len(result["states"])
            stats.blob_bytes += sum(b.nbytes for b in result["hashes"].values())
            return result

        get_batch._wslinkuris = original._wslinkuris
        ObjectManagerAPI.get_batch = get_batch

    def restore(self):
        ObjectManagerAPI.get_batch = self._original

    def take(self):
        """Return counts accumulated since the previous call and reset them."""
        snapshot = {"states": self.states, "blob_bytes": self.blob_bytes}
        self.states = 0
        self.blob_bytes = 0
        return snapshot


async def get_camera_position(page, camera_id):
    return await page.evaluate(
        f"window.trame.refs.view1.getVtkObject({camera_id}).getPosition()"
    )


async def get_actor_color(page, actor_id):
    return await page.evaluate(
        f"""(async () => {{
            const actor = window.trame.refs.view1.getVtkObject({actor_id});
            const prop = await actor.getProperty();
            return await prop.getColor();
        }})()"""
    )


async def apply_hover_highlight(page, actor_id):
    """Emulate a browser-side hover: recolor an actor without telling the server."""
    await page.evaluate(
        f"""(async () => {{
            const view = window.trame.refs.view1;
            const actor = view.getVtkObject({actor_id});
            const prop = await actor.getProperty();
            await prop.setColor(...{HOVER_COLOR});
            view.render();
        }})()"""
    )


async def rotate_camera_with_mouse(page):
    """Drag inside view1 so the client camera differs from the server one."""
    await page.mouse.move(150, 150)
    await page.mouse.down()
    await page.mouse.move(200, 170, steps=10)
    await page.mouse.up()


def format_report(rows):
    lines = ["", "Serialization work per update (view1):"]
    lines.append(
        f"{'step':<28}{'roots':>6}{'serialize (ms)':>16}{'states sent':>13}{'blob bytes':>12}"
    )
    for row in rows:
        lines.append(
            f"{row['step']:<28}{row['roots']!s:>6}{row['seconds'] * 1000:>16.3f}"
            f"{row['states']:>13}{row['blob_bytes']:>12}"
        )
    return "\n".join(lines)


@pytest.mark.asyncio
async def test_partial_update(PartialUpdateApp, utils):
    """Subset updates only re-serialize the requested roots."""
    stats = BatchStats()
    stats.install()
    app = PartialUpdateApp("partial-update")
    task = app.server.start(exec_mode="task", port=0)
    await app.server.ready
    await wasm_downloaded()
    RESULT_BASE = Path(__file__).with_name("results") / "partial_update"
    RESULT_BASE.mkdir(parents=True, exist_ok=True)
    valid_image_comparisons = []
    report = []

    def record(step):
        entry = app.serialize_log[-1]
        report.append({"step": step, **entry, **stats.take()})
        # print("step ================================= ", step, " done")

    async def snapshot(index):
        await utils.wait_for_render(page)
        valid_image_comparisons.append(
            await utils.compare_screenshot(
                page, BASELINES[index], RESULT_BASE, threshold=0.1
            )
        )

    try:
        async with async_playwright() as p:
            browser = await chromium_launch(p)
            page = await browser.new_page()
            await page.set_viewport_size({"width": 600, "height": 300})

            await page.goto(f"http://localhost:{app.server.port}/")
            await utils.wait_for_render(page)
            await expect(page.locator(".readyCount")).to_have_text("2")
            stats.take()  # initial scene download is not part of the comparison
            await snapshot(0)

            camera_id = app.wasm_id(app.renderer_1.GetActiveCamera())
            selected_id = app.wasm_id(app.selected)
            hovered_id = app.wasm_id(app.hovered)
            bystander_id = app.wasm_id(app.bystander)

            # -- transient client-side state: camera + hover -----------------
            server_camera = list(app.renderer_1.GetActiveCamera().GetPosition())
            await rotate_camera_with_mouse(page)
            await apply_hover_highlight(page, hovered_id)
            await snapshot(1)
            client_camera = await get_camera_position(page, camera_id)
            assert client_camera != pytest.approx(server_camera), (
                "mouse drag did not move the client camera"
            )
            assert await get_actor_color(page, hovered_id) == HOVER_COLOR

            # -- 1. subset update: replace a dependency of the selected actor --
            app.replace_selected_mapper(
                vtk.vtkConeSource(
                    center=(-1.5, 0, 0),
                    direction=(0.0, 1.0, 0.0),
                )
            )
            app.bystander.property.color = (
                1,
                0,
                0,
            )  # NOT part of the 'selected' actor.
            app.update_selected_only()
            await expect(page.locator(".readyCount")).to_have_text("3")
            record("subset: replace mapper")
            await snapshot(2)

            assert await get_camera_position(page, camera_id) == pytest.approx(
                client_camera
            ), "subset update reset the client camera"
            assert await get_actor_color(page, hovered_id) == HOVER_COLOR, (
                "subset update dropped the browser-side hover highlight"
            )
            assert await get_actor_color(page, bystander_id) == [1.0, 1.0, 1.0], (
                "subset update leaked an edit made to an object outside the subset"
            )
            assert app.wasm_id(app.selected) == selected_id
            selected_mapper_id = app.wasm_id(app.selected.mapper)
            assert selected_mapper_id, "new mapper was not serialized"

            # -- 2. full update with the same kind of edit -------------------
            app.replace_selected_mapper(
                vtk.vtkConeSource(
                    center=(-1.5, 0, 0), radius=0.5, direction=(0.0, 0.0, 1.0)
                )
            )
            app.update_all()
            await expect(page.locator(".readyCount")).to_have_text("4")
            record("full: replace mapper")
            await snapshot(3)

            assert await get_camera_position(page, camera_id) == pytest.approx(
                client_camera
            ), "full update reset the client camera"
            assert await get_actor_color(page, hovered_id) == HOVER_COLOR, (
                "full update dropped the browser-side hover highlight"
            )
            assert await get_actor_color(page, bystander_id) == [1.0, 0.0, 0.0], (
                "full update did not deliver the edit skipped by the subset update"
            )

            # -- 3. subset again after a full update -------------------------
            app.selected.property.color = (0, 1, 0)
            app.update_selected_only()
            await expect(page.locator(".readyCount")).to_have_text("5")
            record("subset: recolor")
            await snapshot(4)
            assert await get_actor_color(page, selected_id) == [0.0, 1.0, 0.0]
            assert await get_actor_color(page, hovered_id) == HOVER_COLOR

            # -- 4. the other view sharing the session still works -----------
            app.sphere_2.theta_resolution = 32
            app.sphere_2.phi_resolution = 32
            app.ctx.view2.update()
            await expect(page.locator(".readyCount")).to_have_text("6")
            record("view2 full")
            await snapshot(5)
            assert await get_actor_color(page, selected_id) == [0.0, 1.0, 0.0]
            assert await get_actor_color(page, hovered_id) == HOVER_COLOR

            await browser.close()
    finally:
        stats.restore()
        await app.server.stop()
        await task

    text = format_report(report)
    print(text)
    (RESULT_BASE / "serialization_report.txt").write_text(text)

    # Server-side serialization is where the subset saves work. What crosses
    # the wire is driven by mtime diffing on the client and is similar for
    # both strategies, so it is reported but not compared.
    subset, full = report[0], report[1]
    assert subset["roots"] == 1 and full["roots"] == 2
    assert subset["seconds"] < full["seconds"], (
        "subset update did not reduce serialization time:\n" + text
    )

    assert all(valid_image_comparisons), "Some images don't match"
