from pathlib import Path

from playwright.sync_api import Page, expect
import pytest

from trame_client.utils.testing import (
    assert_screenshot_matches,
    assert_snapshot_matches,
)


@pytest.mark.parametrize(
    "server_path",
    [
        "examples/tests/rendering/cone.py",
        "examples/tests/rendering/flow.py",
    ],
)
def test_rendering(server, server_path, page: Page, ref_dir: Path):
    url = f"http://127.0.0.1:{server.port}/"
    page.goto(url)

    page.set_viewport_size({"width": 600, "height": 300})
    expect(page.locator(".readyCount")).to_have_text("1")

    base_name = Path(server_path).stem
    name = f"test_rendering_{base_name}"
    assert_snapshot_matches(page, ref_dir, name)
    assert_screenshot_matches(page, ref_dir, name, threshold=0.1)
