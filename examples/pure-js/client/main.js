import "./style.css";
import Trame from "@kitware/trame";
import { VtkWASMHandler } from "@kitware/trame-vtklocal/dist/esm/remote.mjs";

// ============================================================================
// Helper method/class for wasm view handling
// ============================================================================

function createExtractCallback(trame, wasmManager, extractInfo) {
  return function () {
    wasmManager.clearStateCache();
    for (const [name, props] of Object.entries(extractInfo)) {
      const value = {};
      for (const [propName, statePath] of Object.entries(props)) {
        value[propName] = wasmManager.getStateValue(statePath, true);
      }
      trame.state.set(name, value);
    }
    wasmManager.clearStateCache();
  };
}

// ============================================================================

class WasmView {
  constructor(trame, wasmManager, renderWindowId, container) {
    this.trame = trame;
    this.wasm = wasmManager;
    this.rwId = renderWindowId;
    this.container = container;
    this.cacheSize = 100000000;
    //
    const canvasSelector = this.wasm.bindCanvasToDOM(renderWindowId, container);
    container
      .querySelector(canvasSelector)
      .setAttribute(
        "style",
        "position: absolute; left: 0; top: 0; width: 100%; height: 100%;",
      );
  }

  resetCamera(rendererId) {
    this.wasm.sceneManager.resetCamera(rendererId);
    this.wasm.sceneManager.render(this.rwId);
  }

  evalStateExtract(definition) {
    createExtractCallback(this.trame, this.wasm, definition)();
  }

  async update(bindCanvas = false) {
    if (!this.wasm.loaded) {
      return;
    }
    await this.wasm.update(this.rwId, bindCanvas);
    this.checkMemory();
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    const w = Math.floor(width * window.devicePixelRatio + 0.5);
    const h = Math.floor(height * window.devicePixelRatio + 0.5);
    this.wasm.setSize(this.rwId, w, h);
  }

  checkMemory() {
    this.wasm.freeMemory(this.cacheSize);
  }

  startEventLoop() {
    this.wasm.sceneManager.startEventLoop(this.rwId);
  }

  stopEventLoop() {
    this.wasm.sceneManager.stopEventLoop(this.rwId);
  }
}

// ============================================================================
// Main entrypoint
// ============================================================================

async function connect() {
  // --------------------------------------------------------------------------
  // Trame setup
  // --------------------------------------------------------------------------

  const trame = new Trame();
  await trame.connect({ application: "trame" });
  const wsLinkSession = trame.client.getConnection().getSession();

  // --------------------------------------------------------------------------
  // Network connector
  // --------------------------------------------------------------------------

  async function netFetchState(vtkId) {
    return await wsLinkSession.call("vtklocal.get.state", [vtkId]);
  }

  async function netFetchBlob(hash) {
    return await wsLinkSession.call("vtklocal.get.hash", [hash]);
  }

  async function netFetchStatus(vtkId) {
    return await wsLinkSession.call("vtklocal.get.status", [vtkId]);
  }

  // --------------------------------------------------------------------------
  // WASM setup
  // --------------------------------------------------------------------------

  // Global wasm
  const wasmURL = "./wasm";
  const wasmManager = new VtkWASMHandler();
  wasmManager.bindNetwork(netFetchState, netFetchBlob, netFetchStatus);
  // for addon wasm named "myAddonWebAssembly.{mjs, wasm}"
  // await wasmManager.load(wasmURL, { rendering: "webgl", exec: "sync" }, "myAddon");
  // for addon wasm named "myAddonWebAssemblyAsync.{mjs, wasm}"
  // await wasmManager.load(wasmURL, { rendering: "webgpu", exec: "async" }, "myAddon");
  // Load default wasm i.e, vtkWebAssembly.{mjs, wasm}
  await wasmManager.load(wasmURL);

  // View specific
  const renderWindowWasmId = trame.state.get("wasm_render_window_id");
  const renderWindowWasmRef = trame.state.get("wasm_render_window_ref");
  const viewContainer = document.querySelector(".wasmContent");

  const view = new WasmView(
    trame,
    wasmManager,
    renderWindowWasmId,
    viewContainer,
  );
  trame.refs[renderWindowWasmRef] = view; // Allow server to call method on us (update, resetCamera, evalStateExtract)
  await view.update(true); // only bind on first update

  const resizeObserver = new ResizeObserver(() => view.resize());
  resizeObserver.observe(viewContainer);
  view.startEventLoop();

  // --------------------------------------------------------------------------
  // UI binding using trame infrastructure
  // --------------------------------------------------------------------------

  // Bind resolution
  trame.state.watch(["resolution"], (r) => {
    document.querySelector(".resolution").value = r;
  });
  document.querySelector(".resolution").addEventListener("input", (e) => {
    trame.state.set("resolution", Number(e.target.value));
  });

  // Bind ResetCamera
  document.querySelector(".resetCamera").addEventListener("click", () => {
    trame.trigger("reset_camera");
  });

  // Bind Reset Resolution
  document.querySelector(".resetResolution").addEventListener("click", () => {
    trame.trigger("reset_resolution");
  });
}

// ============================================================================
// Start the app
// ============================================================================

connect();
