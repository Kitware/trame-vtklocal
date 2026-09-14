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
    """Two LocalViews sharing one WASM session must render and interact.

    Catches the updateAsync-serialization regression (a second view's update
    being swallowed leaves it black) and the non-JSPI event-loop regression
    (only the first view receives an Emscripten main loop).
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

        # A synchronous Emscripten runtime has only one native main loop. The
        # second LocalView therefore relies on vtk-wasm's per-view JavaScript
        # ProcessEvents pump. Drag its canvas and verify that a client-side
        # camera state changes; a rendering-only screenshot would miss this
        # regression because both views can paint their initial frame.
        await page.evaluate(
            """() => {
                window.__secondViewCameraState = () => {
                    const session =
                        window.trame.refs.second_view.getRemoteSession();
                    return [...session.cameraIds]
                        .sort((a, b) => a - b)
                        .map((id) => {
                            const state = session.getVtkObject(id).$state;
                            return [
                                id,
                                state.position,
                                state.focalPoint,
                                state.viewUp,
                            ];
                        });
                };
            }"""
        )
        before = await page.evaluate("window.__secondViewCameraState()")
        second_canvas = page.locator("canvas").nth(1)
        bounds = await second_canvas.bounding_box()
        assert bounds is not None
        x = bounds["x"] + bounds["width"] * 0.5
        y = bounds["y"] + bounds["height"] * 0.5
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x + 50, y + 20, steps=8)
        await page.mouse.up()
        await page.wait_for_function(
            """(before) =>
                JSON.stringify(window.__secondViewCameraState()) !==
                JSON.stringify(before)
            """,
            arg=before,
            timeout=3000,
        )

        assert all(valid_image_comparisons), "Some images don't match"

        # Clean up resource
        await browser.close()

    await app.server.stop()
    await task
