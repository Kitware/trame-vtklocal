"""Fail the CI job when the browser is not actually rendering on the GPU.

This runs probe on a secure context. Ask for highPerformance webgpu adapter
since VTK asks for it.
"""

import asyncio
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.async_api import async_playwright

sys.path.insert(0, str(Path(__file__).parent))

from conftest import chromium_launch, webgpu_args  # noqa: E402

SOFTWARE = ("swiftshader", "llvmpipe", "software", "basic render", "warp")

PROBE = """async () => {
    const out = {};
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    out.webgl = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;

    if (!navigator.gpu) {
        out.webgpu = null;
        out.reason = 'navigator.gpu is undefined (WebGPU not enabled in this build/flags)';
        return out;
    }
    let adapter = null;
    let reason = 'requestAdapter resolved to null (no adapter matched)'
    try {
        adapter = await navigator.gpu.requestAdapter();
    } catch (e) {
        reason = 'requestAdapter threw: ' + e;
    }
    if (!adapter) {
        try {
            adapter = await navigator.gpu.requestAdapter({
                powerPreference: 'high-performance',
            });
        } catch (e) {
            reason = 'requestAdapter with high-performance threw: ' + e;
        }
    }
    if (!adapter) {
        out.webgpu = null;
        out.reason = reason;
        return out;
    }
    const i = adapter.info || {};
    out.webgpu = [i.vendor, i.architecture, i.device, i.description]
        .filter(Boolean)
        .join(' ');
    return out;
}"""


async def main():
    handler = partial(SimpleHTTPRequestHandler, directory=str(Path(__file__).parent))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    try:
        async with async_playwright() as p:
            browser = await chromium_launch(p, webgpu_args())
            page = await browser.new_page()
            await page.goto(f"http://127.0.0.1:{server.server_port}/")
            info = await page.evaluate(PROBE)
            await browser.close()
    finally:
        server.shutdown()

    print("WebGL  :", info.get("webgl"))
    print("WebGPU :", info.get("webgpu") or f"unavailable -- {info.get('reason')}")

    failures = []
    webgl = (info.get("webgl") or "").lower()
    if not webgl:
        failures.append("WebGL2 context unavailable")
    elif any(bad in webgl for bad in SOFTWARE):
        failures.append(f"WebGL is on a software rasterizer: {info['webgl']}")

    webgpu = (info.get("webgpu") or "").lower()
    if not webgpu:
        failures.append(
            f"WebGPU unavailable, so webgpu tests will skip: {info.get('reason')}"
        )
    elif any(bad in webgpu for bad in SOFTWARE):
        failures.append(f"WebGPU adapter is a software fallback: {info['webgpu']}")

    if failures:
        for f in failures:
            print("FAIL:", f)
        sys.exit(1)
    print("OK: browser is rendering on the GPU")


asyncio.run(main())
