import "./style.css";

import { VtkWASMLoader } from "./wasmLoader";
import { createVtkObjectProxy } from "./standalone";

// url => loader instance
const WASM_LOADERS = {};

/**
 * RemoteSession type definition
 *
 * @typedef {Object} RemoteSession
 * @property {Boolean} loaded
 * @property {Set<int>} cameraIds
 * @property {wasmSceneManager} sceneManager
 */
export class RemoteSession {
  constructor() {
    this.sceneManager = null;
    this.loaded = false;
    //
    this.updateInProgress = 0;
    this.currentMTime = 1;
    this.stateMTimes = {};
    this.hashesMTime = {};
    this.pendingArrays = {};
    this.networkFetchState = null;
    this.networkFetchHash = null;
    this.networkFetchStatus = null;
    this.cameraIds = new Set();
    this.stateCache = {};
    // FIXME - remove when VTK>=9.5
    this.renderWindowIds = new Set();
    this.renderWindowIdToInteractorId = new Map();
    this.renderWindowSizes = {};

    // vtkObject Proxy handling
    this.vtkProxyCache = new WeakMap();
    this.idToRef = new Map();
    this.internalWrapMethods = {};
    this.internalWrapMethods.isVtkObject = (obj) => this.vtkProxyCache.has(obj);
    this.internalWrapMethods.decorateKwargs = (kwargs) => {
      const wrapped = {};
      Object.entries(kwargs).forEach(([k, v]) => {
        if (this.vtkProxyCache.has(v)) {
          wrapped[k] = v.obj;
        } else {
          wrapped[k] = v;
        }
      });
      return wrapped;
    };
    this.internalWrapMethods.decorateArgs = (args) => {
      return args.map((v) => (this.vtkProxyCache.has(v) ? v.obj : v));
    };
    this.internalWrapMethods.decorateResult = (result) => {
      if (result == null) {
        return result;
      }
      if (result?.Id) {
        return createVtkObjectProxy(
          this.sceneManager,
          this.vtkProxyCache,
          this.idToRef,
          this.internalWrapMethods,
          result.Id,
        );
      }
      return result;
    };

    // Canvas management
    this.offlineCanvasContainer = document.createElement("div");
    this.offlineCanvasContainer.setAttribute("class", "unused-canvas");
    document.body.appendChild(this.offlineCanvasContainer);
  }

  /**
   * Load VTK WASM library using the base url provided
   *
   * @param {str} wasmBaseURL
   */
  async load(wasmBaseURL, config, wasmBaseName) {
    if (!WASM_LOADERS[wasmBaseURL]) {
      WASM_LOADERS[wasmBaseURL] = new VtkWASMLoader();
    }

    await WASM_LOADERS[wasmBaseURL].load(wasmBaseURL, config, wasmBaseName);
    this.sceneManager =
      await WASM_LOADERS[wasmBaseURL].createRemoteSession(config);
    this.stateDecorator = WASM_LOADERS[wasmBaseURL].createStateDecorator();
    this.loaded = true;

    // Ignore state properties - only in 9.5
    if (this.sceneManager.skipProperty) {
      // Will be enough when wasm check for superclass
      this.sceneManager.skipProperty("vtkRenderWindow", "Size");
      // FIXME: but for now we need specific class (window/linux/mac/wasm)
      [
        "vtkWin32OpenGLRenderWindow",
        "vtkXOpenGLRenderWindow",
        "vtkCocoaRenderWindow",
        "vtkWebAssemblyOpenGLRenderWindow",
      ].forEach((className) =>
        this.sceneManager.skipProperty(className, "Size"),
      );
    }
  }

  /**
   * Inject network implementation for fetching state and blob
   */
  bindNetwork(fetchState, fetchHash, fetchStatus) {
    this.networkFetchState = fetchState;
    this.networkFetchHash = fetchHash;
    this.networkFetchStatus = fetchStatus;
  }

  /**
   * Free old blobs if they go beyond the allowed cache size in Bytes
   * starting with the older ones.
   *
   * @param {int} cacheSize
   */
  freeMemory(cacheSize = 0) {
    const memArrays = this.sceneManager.getTotalBlobMemoryUsage();
    const threshold = Number(cacheSize);

    if (memArrays > threshold) {
      // Need to remove old blobs
      const tsMap = {};
      let mtimeToFree = this.currentMTime;
      Object.entries(this.hashesMTime).forEach(([hash, mtime]) => {
        if (mtime < mtimeToFree) {
          mtimeToFree = mtime;
        }
        const sMtime = mtime.toString();
        if (tsMap[sMtime]) {
          tsMap[sMtime].push(hash);
        } else {
          tsMap[sMtime] = [hash];
        }
      });

      // Remove blobs starting by the old ones
      while (this.sceneManager.getTotalBlobMemoryUsage() > threshold) {
        const hashesToDelete = tsMap[mtimeToFree];
        if (hashesToDelete) {
          for (let i = 0; i < hashesToDelete.length; i++) {
            this.sceneManager.unRegisterBlob(hashesToDelete[i]);
            delete this.hashesMTime[hashesToDelete[i]];
          }
        }
        mtimeToFree++;
      }
    }
  }

  /**
   * Fetch and register state inside sceneManager
   *
   * @param {int} vtkId
   * @returns fetched state as string
   */
  async fetchState(vtkId) {
    const serverState = await this.networkFetchState(vtkId);
    return this.patchState(serverState);
  }

  /**
   * Push state to internal structure
   *
   * @param {str} state
   */
  patchState(state) {
    if (state.length > 0) {
      const stateObj = JSON.parse(state);
      const { Id, MTime } = stateObj;
      this.stateMTimes[Id] = MTime;

      if (
        !this.sceneManager.skipProperty ||
        !this.sceneManager.bindRenderWindow
      ) {
        // Not needed in >=9.5
        if (this.renderWindowIds.has(Id) && stateObj?.Interactor?.Id) {
          this.renderWindowIdToInteractorId.set(stateObj.Interactor.Id, Id);

          // Connect canvas selector
          stateObj.CanvasSelector = this.getCanvasSelector(Id);

          // Don't use server side size (ignore prop skip it)
          delete stateObj["Size"];
          if (this.renderWindowSizes[Id]) {
            stateObj.Size = this.renderWindowSizes[Id];
          }

          // Need to patch classname to allow OSMesa server to work
          stateObj.ClassName = "vtkCocoaRenderWindow";

          return JSON.stringify(stateObj);
        }

        // Interactor - to remove once API available on C++ side
        if (this.renderWindowIdToInteractorId.has(Id)) {
          // Connect canvas selector
          stateObj.CanvasSelector = this.getCanvasSelector(
            this.renderWindowIdToInteractorId.get(Id),
          );
          return JSON.stringify(stateObj);
        }
      }
      return state;
    }
  }

  /**
   * Fetch and register blob inside sceneManager
   *
   * @param {str} hash
   * @returns typed array matching blob content
   */
  async fetchHash(hash) {
    // pendingArray only filled via pushHash
    if (this.pendingArrays[hash]) {
      await this.pendingArrays[hash];
      this.hashesMTime[hash] = this.currentMTime;
      delete this.pendingArrays[hash];
      return;
    }
    // regular network call
    const array = await this.networkFetchHash(hash);
    this.sceneManager.registerBlob(hash, array);
    this.hashesMTime[hash] = this.currentMTime;
    return array;
  }

  /**
   * Push blob to internal structure
   * @param {str} hash
   * @param {TypedArry or Blob} arrayOrBlob
   */
  pushHash(hash, arrayOrBlob) {
    this.pendingArrays[hash] = new Promise((resolve) => {
      if (arrayOrBlob.arrayBuffer) {
        arrayOrBlob.arrayBuffer().then((buffer) => {
          this.sceneManager.registerBlob(hash, new Uint8Array(buffer));
          this.hashesMTime[hash] = this.currentMTime;
          resolve();
        });
      } else {
        this.sceneManager.registerBlob(hash, arrayOrBlob);
        this.hashesMTime[hash] = this.currentMTime;
        resolve();
      }
    });
    return this.pendingArrays[hash];
  }

  /**
   * Update object with its dependencies to match remote version.
   *
   * @param {int} vtkId
   */
  async update(vtkId, bindCanvas = false) {
    // Not needed once 9.5 is out...
    this.renderWindowIds.add(vtkId);

    this.updateInProgress++;
    if (this.updateInProgress !== 1) {
      // console.error("Skip concurrent update");
      return;
    }

    try {
      const serverStatus = await this.networkFetchStatus(vtkId);
      const pendingHashes = [];
      const pendingStates = [];

      // Handle forcepush if any
      const resetIds = serverStatus.force_push || [];
      for (let i = 0; i < resetIds.length; i++) {
        delete this.stateMTimes[resetIds[i]];
      }

      // Fetch any state that needs update
      serverStatus.ids.forEach(([vtkId, mtime]) => {
        if (!this.stateMTimes[vtkId] || this.stateMTimes[vtkId] < mtime) {
          pendingStates.push(this.fetchState(vtkId));
        }
      });

      // Fetch any blob that is missing
      serverStatus.hashes.forEach((hash) => {
        if (!this.hashesMTime[hash]) {
          pendingHashes.push(this.fetchHash(hash));
        }
        this.hashesMTime[hash] = this.currentMTime;
      });

      // Capture cameras
      serverStatus.cameras.forEach((v) => this.cameraIds.add(Number(v)));

      // Remove state that should be ignored
      serverStatus.ignore_ids.forEach((vtkId) =>
        this.sceneManager.unRegisterState(vtkId),
      );

      // Ensure completion of all network calls
      await Promise.all(pendingHashes);
      await Promise.all(Object.values(this.pendingArrays));
      const statesToRegister = await Promise.all(pendingStates);
      this.currentMTime++;

      // Register states in a synchronous manner to prevent intermixed render from interactor
      while (statesToRegister.length) {
        const state = statesToRegister.pop();
        if (state) {
          this.sceneManager.registerState(this.stateDecorator(state));
        }
      }

      // Bump local mtime and process states to reflect server state
      try {
        this.sceneManager.updateObjectsFromStates();
        const [w, h] = this.renderWindowSizes[vtkId] || [10, 10];
        this.sceneManager.setSize(vtkId, w, h);

        // Prevent state patching with new API
        if (bindCanvas && this.sceneManager.bindRenderWindow) {
          this.sceneManager.bindRenderWindow(
            vtkId,
            this.getCanvasSelector(vtkId),
          );
        }

        await this.sceneManager.render(vtkId);
        // TODO outside:
        // - freeMemory: to keep memory in check
      } catch (e) {
        console.error("WASM update failed");
        console.log(e);
      }
    } catch (e) {
      console.error("Error in update", e);
    } finally {
      this.updateInProgress--;
      if (this.updateInProgress) {
        this.updateInProgress = 0;
        await this.update(vtkId);
      }
    }
  }

  /**
   * Helper to retrieve local object state
   *
   * @param {int} vtkId
   * @returns state of given vtk object
   */
  getState(vtkId, useCache = false) {
    const wasmId = Number(vtkId);
    if (useCache && this.stateCache[wasmId]) {
      return this.stateCache[wasmId];
    }
    // New API
    if (this.sceneManager.get) {
      return this.sceneManager.get(wasmId);
    }
    // Old API
    this.sceneManager.updateStateFromObject(wasmId);
    return this.sceneManager.getState(wasmId);
  }

  /**
   * Clear state cache
   */
  clearStateCache() {
    this.stateCache = {};
  }

  /**
   * Helper to query local object value for a given property
   *
   * @param {Array or vtkId} valuePath
   * @returns property value
   */
  getStateValue(valuePath, useCache = false) {
    const expression = Array.isArray(valuePath) ? valuePath : [valuePath];
    let value = null;
    for (let i = 0; i < expression.length; i++) {
      const token = expression[i];
      if (i === 0) {
        value = this.getState(token, useCache);
      } else {
        value = value[token];
        if (value.Id) {
          value = this.getState(value.Id, useCache);
        }
      }
    }
    return value;
  }

  /**
   * Return canvas selector based on renderWindowId
   *
   * @param {int} renderWindowId
   * @returns the selector string to find the given canvas
   */
  getCanvasSelector(renderWindowId) {
    return `.vtk-wasm-${renderWindowId}`;
  }

  /**
   * Create canvas if missing and add it to the provided targetElement container.
   *
   * @param {int} renderWindowId
   * @param {HTMLElement} targetElement
   * @returns the canvas selector string
   */
  bindCanvasToDOM(renderWindowId, targetElement) {
    const canvasSelector = this.getCanvasSelector(renderWindowId);
    let canvas = this.offlineCanvasContainer.querySelector(canvasSelector);

    if (!canvas) {
      // Create it
      canvas = document.createElement("canvas");
      canvas.setAttribute("class", canvasSelector.substring(1));
      canvas.setAttribute("tabindex", "0");
      // @contextmenu.prevent
      // @click="canvas.focus()"
      // @mouseenter="canvas.focus()"
    }

    targetElement.appendChild(canvas);
    return canvasSelector;
  }

  /**
   * Remove canvas from its current container but keep it for possible followup usage.
   *
   * @param {int} renderWindowId
   */
  unbindCanvasToDOM(renderWindowId) {
    const canvasSelector = this.getCanvasSelector(renderWindowId);
    const canvas = document.querySelector(canvasSelector);
    if (canvas) {
      this.offlineCanvasContainer.appendChild(canvas);
    }
  }

  /**
   * Set size to the given RenderWindow
   *
   * @param {int} renderWindowId
   * @param {int} width
   * @param {int} height
   */
  async setSize(renderWindowId, width, height) {
    this.renderWindowSizes[renderWindowId] = [width, height];
    const canvasSelector = this.getCanvasSelector(renderWindowId);
    const canvas = document.querySelector(canvasSelector);
    if (canvas) {
      canvas.width = width;
      canvas.height = height;

      this.sceneManager.setSize(renderWindowId, width, height);
      await this.sceneManager.render(renderWindowId);
    }
  }
  /**
   * @typedef {object} vtkObject
   * @property {number} id - WASM id
   * @property {object} obj - Return id wrapped as an object {Id: wasmId}.
   * @property {object} state - Return full object state
   * @method delete - Remove object from WASM stack
   * @method set - Update a batch of properties at once using keyword arguments
   * @method observe(eventName, fn) -> tag - Attach listener on a specific event
   * @method unObserve(tag) - Detach listener
   * @method unObserveAll() - Detach all listeners
   * @property VTK Property Name - Read VTK property from its state
   * @property VTK Property Name as Setter - Set VTK property
   * @method VTK Method Name - Async call to vtk internal
   */
  /**
   * Get a helper proxy for controlling the vtkObject available on the WASM side.
   * @param {number} vtkId - wasm id for given vtkObject
   * @returns {vtkObject}
   */
  getVtkObject(vtkId) {
    return createVtkObjectProxy(
      this.sceneManager,
      this.vtkProxyCache,
      this.idToRef,
      this.internalWrapMethods,
      vtkId,
    );
  }
}

// For backward compatibility
export const VtkWASMHandler = RemoteSession;
