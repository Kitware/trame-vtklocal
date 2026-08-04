from pathlib import Path
from trame_vtklocal.module.wasm import wasm_downloaded

import pytest
from playwright.async_api import async_playwright, expect

from conftest import chromium_launch

BASELINES = [
    Path(__file__).with_name("assets") / "multi_view" / name
    for name in [
        "00_startup",
    ]
]


@pytest.mark.asyncio
async def test_multi_view(MultiViewApp, utils):
    """Two LocalViews sharing one WASM session must both render (issues/76, /77).

    Catches the updateAsync-serialization regression (a second view's update
    being swallowed leaves it black).
    """
    app = MultiViewApp("multi-view")
    task = app.server.start(exec_mode="task", port=0)
    await app.server.ready
    await wasm_downloaded()
    RESULT_BASE = Path(__file__).with_name("results") / "multi_view"
    valid_image_comparisons = []

    async with async_playwright() as p:
        browser = await chromium_launch(p)
        page = await browser.new_page()
        await page.set_viewport_size({"width": 600, "height": 300})

        await page.goto(f"http://localhost:{app.server.port}/")
        await utils.wait_for_render(page)
        # Both views increment the counter once they have rendered.
        await expect(page.locator(".readyCount")).to_have_text("2")
        valid_image_comparisons.append(
            await utils.compare_screenshot(
                page, BASELINES[0], RESULT_BASE, threshold=0.1
            )
        )

        assert all(valid_image_comparisons), "Some images don't match"

        # Clean up resource
        await browser.close()

    await app.server.stop()
    await task
