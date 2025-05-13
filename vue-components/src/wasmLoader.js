const LOADED_URLS = [];
const PROMISES = {};

/**
 * Create a future that returns
 * @returns { promise, resolve, reject }
 */
export function createFuture() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Add script tag with provided URL with type="module"
 *
 * @param {string} url
 * @return {Promise<void>} to know when the script is ready
 */
export function loadScriptAsModule(url) {
  if (PROMISES[url]) {
    return PROMISES[url];
  }

  PROMISES[url] = new Promise(function (resolve, reject) {
    if (LOADED_URLS.indexOf(url) === -1) {
      LOADED_URLS.push(url);
      var newScriptTag = document.createElement("script");
      newScriptTag.type = "module";
      newScriptTag.src = url;
      newScriptTag.onload = resolve;
      newScriptTag.onerror = reject;
      document.body.appendChild(newScriptTag);
    } else {
      resolve(false);
    }
  });

  return PROMISES[url];
}

/**
 * VtkWASMLoader type definition
 *
 * @typedef {Object} VtkWASMLoader
 * @property {Boolean} loaded
 */
export class VtkWASMLoader {
  constructor() {
    this.loaded = false;
    this.loadingPending = null;
    this.wasm = null;
  }

  /**
   * Load VTK WASM library using the base url provided
   *
   * If you want to pipe std::cout and std::cerr to the console,
   * you can provide a config like so:
   *
   *   config = {
   *     print: console.info,
   *     printErr: console.error,
   *   }
   *
   * @param {str} wasmBaseURL
   * @param {object} config - for WASM runtime creation.
   */
  async load(wasmBaseURL, config = {}) {
    if (this.loaded) {
      return;
    }

    if (!this.loadingPending) {
      const { promise, resolve } = createFuture();
      this.loadingPending = promise;

      // Check which wasm bundle we have
      let url = null;
      let jsModuleURL = null;

      // Try newest version first
      url = `${wasmBaseURL}/vtkWebAssemblyInterface.mjs`;
      const newModuleResponse = await fetch(url);
      if (newModuleResponse.ok) {
        jsModuleURL = url;
      }

      // Try older version
      if (!jsModuleURL) {
        url = `${wasmBaseURL}/vtkWasmSceneManager.mjs`;
        const oldModuleResponse = await fetch(url);
        if (oldModuleResponse.ok) {
          jsModuleURL = url;
        }
      }

      // Not sure what to do
      if (!jsModuleURL) {
        throw new Error(`Could not fetch wasm bundle from ${wasmBaseURL}`);
      }

      // Load JS
      await loadScriptAsModule(jsModuleURL);

      // Load WASM
      if (window.createVTKWASM) {
        this.wasm = await window.createVTKWASM(config);
      }

      // Capture objects
      this.loaded = true;
      resolve();
    } else {
      await this.loadingPending;
    }
  }

  /**
   * Create a new remote session and return it regardless of WASM version.
   *
   * @returns
   */
  async createRemoteSession() {
    if (this.wasm) {
      // New API
      return new this.wasm.vtkRemoteSession();
    }

    // Old API
    const remoteSession = await window.createVTKWasmSceneManager();
    remoteSession.initialize();
    return remoteSession;
  }

  /**
   * Create a new standalone session. Only works with new WASM bundle.
   *
   * @returns
   */
  createStandaloneSession() {
    if (!this.wasm) {
      throw new Error("Current WASM version does not support standalone mode");
    }
    return new this.wasm.vtkStandaloneSession();
  }
}
