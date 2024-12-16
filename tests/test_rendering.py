from pathlib import Path
import pytest
from seleniumbase import SB
from trame_client.utils.testing import set_browser_size, baseline_comparison


def to_baseline(example_path):
    tpl_path = f"visual_baseline/test_rendering[{example_path}]/init/baseline.png"
    base_path = Path(__file__).parent.parent
    image_path = base_path / tpl_path

    if not image_path.exists():
        print(f" => Missing baseline for {image_path}")

    return image_path


@pytest.mark.parametrize(
    "server_path",
    [
        "examples/tests/rendering/cone.py",
        "examples/tests/rendering/flow.py",
    ],
)
def test_rendering(server, server_path, baseline_image):
    with SB() as sb:
        url = f"http://127.0.0.1:{server.port}/"
        sb.open(url)
        set_browser_size(sb, 600, 300)
        sb.assert_exact_text("1", ".readyCount")
        sb.check_window(name="init", level=3)
        baseline_comparison(sb, to_baseline(server_path), 0.1)
