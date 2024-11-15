import "./style.css";

const LOADED_URLS = [];

function loadScriptAsModule(url) {
  return new Promise(function (resolve, reject) {
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
}

export class VtkWASMHandler {
  constructor() {
    this.updateInProgress = 0;
    this.loaded = false;
    this.currentMTime = 1;
    this.stateMTimes = {};
    this.hashesMTime = {};
    this.pendingArrays = {};
    this.networkFetchState = null;
    this.networkFetchHash = null;
    this.networkFetchStatus = null;
    this.cameraIds = new Set();
    this.stateCache = {};
    // FIXME - to remove once API available on C++ side
    this.renderWindowIds = new Set();
    this.renderWindowIdToInteractorId = new Map();
    this.renderWindowSizes = {};

    // Canvas management
    this.offlineCanvasContainer = document.createElement("div");
    this.offlineCanvasContainer.setAttribute("class", "unused-canvas");
    document.body.appendChild(this.offlineCanvasContainer);
  }

  /**
   * Load VTK WASM library using the base url provided
   *
   * FIXME: canvas should not be provided here
   *
   * @param {str} wasmBaseURL
   */
  async load(wasmBaseURL) {
    if (this.loaded) {
      return;
    }
    // Load JS
    const jsModuleURL = `${wasmBaseURL}/vtkWasmSceneManager.mjs`;
    await loadScriptAsModule(jsModuleURL);

    // Load WASM
    const objectManager = await window.createVTKWasmSceneManager();
    objectManager.initialize();

    // Capture objects
    this.loaded = true;
    this.sceneManager = objectManager;
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

      // RenderWindow - to remove once API available on C++ side
      if (this.renderWindowIds.has(Id) && stateObj?.Interactor?.Id) {
        this.renderWindowIdToInteractorId.set(stateObj.Interactor.Id, Id);
        stateObj.CanvasSelector = this.getCanvasSelector(Id);
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
        stateObj.CanvasSelector = this.getCanvasSelector(
          this.renderWindowIdToInteractorId.get(Id)
        );
        return JSON.stringify(stateObj);
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
  async update(vtkId) {
    // FIXME - to remove once API available on C++ side
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
      serverStatus.cameras.forEach((v) => Number(this.cameraIds.add(v)));

      // Remove state that should be ignored
      serverStatus.ignore_ids.forEach((vtkId) =>
        this.sceneManager.unRegisterState(vtkId)
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
          this.sceneManager.registerState(state);
        }
      }

      // Bump local mtime and process states to reflect server state
      try {
        this.sceneManager.updateObjectsFromStates();
        const [w, h] = this.renderWindowSizes[vtkId] || [10, 10];
        this.sceneManager.setSize(vtkId, w, h);
        this.sceneManager.render(vtkId);
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
  setSize(renderWindowId, width, height) {
    this.renderWindowSizes[renderWindowId] = [width, height];
    const canvasSelector = this.getCanvasSelector(renderWindowId);
    const canvas = document.querySelector(canvasSelector);
    if (canvas) {
      canvas.width = width;
      canvas.height = height;

      this.sceneManager.setSize(renderWindowId, width, height);
      this.sceneManager.render(renderWindowId);
    }
  }
}
