import asyncio
from pathlib import Path

import pytest
from playwright.async_api import async_playwright, expect

BASELINES = [
    Path(__file__).with_name("assets") / "cone" / name
    for name in [
        "00_startup.png",
        "01_update_resolution.png",
        "02_unmount.png",
        "03_remount.png",
    ]
]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "config",
    [
        ("wasm32", "sync", "webgl"),
        ("wasm32", "async", "webgl"),
        ("wasm64", "sync", "webgl"),
        ("wasm64", "async", "webgl"),
        ("wasm32", "async", "webgpu"),
        ("wasm64", "async", "webgpu"),
    ],
)
async def test_cone(ConeApp, utils, config):
    wasm_mode, wasm_exec, wasm_rendering = config
    conf_key = f"{wasm_mode}-{wasm_exec}-{wasm_rendering}"
    app = ConeApp(f"cone-{conf_key}", wasm_mode, wasm_exec, wasm_rendering)
    task = app.server.start(exec_mode="task", port=0)
    await app.server.ready
    RESULT_BASE = Path(__file__).with_name("results") / "cone" / conf_key

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.set_viewport_size({"width": 300, "height": 300})

        await page.goto(f"http://localhost:{app.server.port}/")
        await expect(page.locator(".readyCount")).to_have_text("1")
        await utils.assert_screenshot(page, BASELINES[0], RESULT_BASE, threshold=0.1)

        app.resolution = 60
        await expect(page.locator(".readyCount")).to_have_text("2")
        await utils.assert_screenshot(page, BASELINES[1], RESULT_BASE, threshold=0.1)

        app.mounted = False
        app.resolution = 4
        await utils.assert_screenshot(page, BASELINES[2], RESULT_BASE, threshold=0.1)

        app.mounted = True
        await asyncio.sleep(0.1)  # Debounced resize needs complete
        await expect(page.locator(".readyCount")).to_have_text("3")
        await utils.assert_screenshot(page, BASELINES[3], RESULT_BASE, threshold=0.1)

        # Clean up resource
        await browser.close()

    await app.server.stop()
    await task
