import asyncio
from pathlib import Path

import pytest
from playwright.async_api import async_playwright, expect

BASELINES = [
    Path(__file__).with_name("assets") / "volume" / name
    for name in [
        "00_startup",
        "01_update_pwf",
        "02_unmount",
        "03_remount",
    ]
]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "mapper_type",
    [
        "Smart",
        # "FixedPoint",
        "GPU",
        "RayCast",
    ],
)
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
async def test_volume_rendering(VolumeApp, utils, config, mapper_type):
    wasm_mode, wasm_exec, wasm_rendering = config
    conf_key = f"{wasm_mode}-{wasm_exec}-{wasm_rendering}-{mapper_type}"
    app = VolumeApp(
        f"volume-rendering-{conf_key}",
        wasm_mode,
        wasm_exec,
        wasm_rendering,
        mapper_type,
    )
    task = app.server.start(exec_mode="task", port=0)
    await app.server.ready
    RESULT_BASE = Path(__file__).with_name("results") / "volume" / conf_key
    valid_image_comparisons = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.set_viewport_size({"width": 300, "height": 300})

        await page.goto(f"http://localhost:{app.server.port}/")
        await asyncio.sleep(0.1)  # wait for page load
        await expect(page.locator(".readyCount")).to_have_text("1")
        valid_image_comparisons.append(
            await utils.compare_screenshot(
                page, BASELINES[0], RESULT_BASE, threshold=0.1
            )
        )

        app.update_pwf()
        await expect(page.locator(".readyCount")).to_have_text("2")
        valid_image_comparisons.append(
            await utils.compare_screenshot(
                page, BASELINES[1], RESULT_BASE, threshold=0.1
            )
        )

        app.mounted = False
        app.resolution = 4
        valid_image_comparisons.append(
            await utils.compare_screenshot(
                page, BASELINES[2], RESULT_BASE, threshold=0.1
            )
        )

        app.mounted = True
        await asyncio.sleep(0.1)  # Debounced resize needs complete
        await expect(page.locator(".readyCount")).to_have_text("3")
        valid_image_comparisons.append(
            await utils.compare_screenshot(
                page, BASELINES[3], RESULT_BASE, threshold=0.1
            )
        )

        assert all(valid_image_comparisons), "Some images don't match"

        # Clean up resource
        await browser.close()

    await app.server.stop()
    await task
