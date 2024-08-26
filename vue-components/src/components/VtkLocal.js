import { inject, ref, unref, onMounted, onBeforeUnmount } from "vue";
import { createModule } from "../utils";

function idToState(sceneManager, cid) {
  sceneManager.updateStateFromObject(cid);
  return sceneManager.getState(cid);
}

function createExtractCallback(trame, sceneManager, extractInfo) {
  return function () {
    for (const [name, objIds] of Object.entries(extractInfo)) {
      const value = {};
      for (const [objId, props] of Object.entries(objIds)) {
        const state = idToState(sceneManager, objId);
        if (typeof props === "string") {
          value[props] = state;
        } else {
          // extract and remap
          for (const [k, v] of Object.entries(props)) {
            value[v] = state[k];
          }
        }
      }
      trame.state.set(name, value);
    }
  };
}

export default {
  emits: ["updated", "memory-vtk", "memory-arrays", "camera"],
  props: {
    renderWindow: {
      type: Number,
    },
    eagerSync: {
      type: Boolean,
      default: false,
    },
    cacheSize: {
      type: Number,
      default: 100000000,
    },
    wsClient: {
      type: Object,
    },
    listeners: {
      type: Object,
      // {
      //    cid: {
      //       ModifiedEvent: {
      //          varName: {
      //             objId: {
      //                "PropName": "keyInJS_varName",
      //                "PropName2": "key2InJS_varName",
      //             },
      //             objId: "keyInJS_fullState",
      //          },
      //       },
      //    }
      // }
    },
  },
  setup(props, { emit }) {
    const trame = inject("trame");
    const wasmURL = trame.state.get("__trame_vtklocal_wasm_url");
    const cameraIds = [];
    const observerTags = [];
    const container = ref(null);
    const canvas = ref(null);
    const client = props.wsClient || trame?.client;
    const stateMTimes = {};
    const hashesMTime = {};
    const pendingArrays = {};
    const currentMTime = ref(1);
    let sceneManager = null;
    let updateInProgress = 0;
    let subscription = null;

    // Subscription handling --------------------------------------------------

    function handleMessage([event]) {
      if (event.type === "state") {
        const { mtime, content, id } = event;
        sceneManager.unRegisterState(id);
        sceneManager.registerState(content);
        stateMTimes[id] = mtime;
      }
      if (event.type === "blob") {
        const { hash, content } = event;
        pendingArrays[hash] = new Promise((resolve) => {
          if (content.arrayBuffer) {
            content.arrayBuffer().then((buffer) => {
              sceneManager.registerBlob(hash, new Uint8Array(buffer));
              resolve();
            });
          } else {
            sceneManager.registerBlob(hash, content);
            resolve();
          }
        });
      }
    }

    async function subscribe() {
      const session = client.getConnection().getSession();
      subscription = session.subscribe("vtklocal.subscriptions", handleMessage);
      await session.call("vtklocal.subscribe.update", [props.renderWindow, +1]);
    }

    async function unsubscribe() {
      const session = client.getConnection().getSession();
      if (subscription) {
        session.unsubscribe(subscription);
        subscription = null;
      }
      await session.call("vtklocal.subscribe.update", [props.renderWindow, -1]);
    }

    // Resize -----------------------------------------------------------------

    function resize() {
      const { width, height } = container.value.getBoundingClientRect();
      const w = Math.floor(width * window.devicePixelRatio + 0.5);
      const h = Math.floor(height * window.devicePixelRatio + 0.5);
      const canvasDOM = unref(canvas);
      if (canvasDOM && sceneManager && props.renderWindow) {
        canvasDOM.width = w;
        canvasDOM.height = h;
        // console.log(`vtkLocal::resize ${width}x${height}`);
        sceneManager.setSize(props.renderWindow, w, h);
        sceneManager.render(props.renderWindow);
      }
    }
    let resizeObserver = new ResizeObserver(resize);

    // Fetch ------------------------------------------------------------------

    async function fetchState(vtkId) {
      const session = client.getConnection().getSession();
      const serverState = await session.call("vtklocal.get.state", [vtkId]);
      if (serverState.length > 0) {
        stateMTimes[vtkId] = JSON.parse(serverState).MTime;
        // console.log(`vtkLocal::state(${vtkId})`);
        sceneManager.unRegisterState(vtkId);
        sceneManager.registerState(serverState);
      } else {
        console.log(`Server returned empty state for ${vtkId}`);
        // throw new Error(`Server returned empty state for ${vtkId}`);
      }
      return serverState;
    }

    async function fetchHash(hash) {
      if (pendingArrays[hash]) {
        await pendingArrays[hash];
        hashesMTime[hash] = unref(currentMTime);
        delete pendingArrays[hash];
        return;
      }
      const session = client.getConnection().getSession();
      // console.log(`vtkLocal::hash(${hash}) - before`);
      const content = await session.call("vtklocal.get.hash", [hash]);
      const array = content.arrayBuffer
        ? new Uint8Array(await content.arrayBuffer())
        : content;
      sceneManager.registerBlob(hash, array);
      hashesMTime[hash] = unref(currentMTime);
      return array;
    }

    // Memory -----------------------------------------------------------------

    function checkMemory() {
      const memVtk = sceneManager.getTotalVTKDataObjectMemoryUsage();
      const memArrays = sceneManager.getTotalBlobMemoryUsage();
      const threshold = Number(props.cacheSize) + memVtk;

      if (memArrays > threshold) {
        // Need to remove old blobs
        const tsMap = {};
        let mtimeToFree = unref(currentMTime);
        Object.entries(hashesMTime).forEach(([hash, mtime]) => {
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
        while (sceneManager.getTotalBlobMemoryUsage() > threshold) {
          const hashesToDelete = tsMap[mtimeToFree];
          if (hashesToDelete) {
            for (let i = 0; i < hashesToDelete.length; i++) {
              // console.log(
              //   `Delete hash(${hashesToDelete[i]}) - mtime: ${mtimeToFree}`
              // );
              sceneManager.unRegisterBlob(hashesToDelete[i]);
              delete hashesMTime[hashesToDelete[i]];
            }
          }
          mtimeToFree++;
        }
      }
      emit("memory-vtk", sceneManager.getTotalVTKDataObjectMemoryUsage());
      emit("memory-arrays", sceneManager.getTotalBlobMemoryUsage());
    }

    // Update -----------------------------------------------------------------

    async function update() {
      updateInProgress++;
      if (updateInProgress !== 1) {
        // console.error("Skip concurrent update");
        return;
      }

      try {
        // console.log("vtkLocal::update(begin)");
        const session = client.getConnection().getSession();
        const serverStatus = await session.call("vtklocal.get.status", [
          props.renderWindow,
        ]);
        const pendingRequests = [];
        // console.log("ids", serverStatus.ids);
        serverStatus.ids.forEach(([vtkId, mtime]) => {
          if (!stateMTimes[vtkId] || stateMTimes[vtkId] < mtime) {
            // console.log("fetch", vtkId);
            pendingRequests.push(fetchState(vtkId));
          } else {
            // console.log("skip", vtkId);
          }
        });

        // For listeners
        cameraIds.push(...serverStatus.cameras);
        // interactorId = serverStatus.interactor;

        serverStatus.ignore_ids.forEach((vtkId) => {
          sceneManager.unRegisterState(vtkId);
        });
        serverStatus.hashes.forEach((hash) => {
          if (!hashesMTime[hash]) {
            pendingRequests.push(fetchHash(hash));
          }
          hashesMTime[hash] = unref(currentMTime);
        });
        await Promise.all(pendingRequests);
        currentMTime.value++;
        try {
          sceneManager.updateObjectsFromStates();
          // typically, server side framebuffer is arbitrary size, not synchronized with canvas size.
          // render after deserialization so that the server-side size gets seen by VTK's OpenGL cache.
          sceneManager.render(props.renderWindow);
          // now resize to fit canvas, the previous render is required otherwise, VTK's OpenGL cache
          // thinks a resize is not necessary because the size is same as before state update.
          resize();
        } catch (e) {
          console.error("WASM update failed");
          console.log(e);
        }
        emit("updated");
        checkMemory();
      } catch (e) {
        console.error("Error in update", e);
      } finally {
        updateInProgress--;
        if (updateInProgress) {
          updateInProgress = 0;
          await update();
        }
      }
    }

    // resetCamera ------------------------------------------------------------

    function resetCamera(rendererId) {
      sceneManager.resetCamera(rendererId);
      sceneManager.render(props.renderWindow);
    }

    // Life Cycles ------------------------------------------------------------

    onMounted(async () => {
      // console.log("vtkLocal::mounted");
      sceneManager = await createModule(unref(canvas), wasmURL);
      if (props.eagerSync) {
        subscribe();
      }
      await update();

      // Camera listener
      for (let i = 0; i < cameraIds.length; i++) {
        const cid = cameraIds[i];
        observerTags.push([
          cid,
          sceneManager.addObserver(cid, "ModifiedEvent", () => {
            sceneManager.updateStateFromObject(cid);
            const cameraState = sceneManager.getState(cid);
            emit("camera", cameraState);
          }),
        ]);
      }

      // Other listeners
      for (const [cid, eventMap] of Object.entries(props.listeners || {})) {
        for (const [eventName, extractInfo] of Object.entries(eventMap || {})) {
          observerTags.push([
            cid,
            sceneManager.addObserver(
              cid,
              eventName,
              createExtractCallback(trame, sceneManager, extractInfo)
            ),
          ]);
        }
      }

      sceneManager.startEventLoop(props.renderWindow);
      if (resizeObserver) {
        resizeObserver.observe(unref(container));
      }
    });

    onBeforeUnmount(() => {
      if (subscription) {
        unsubscribe();
      }

      // Camera listeners
      while (observerTags.length) {
        const [cid, tag] = observerTags.pop();
        sceneManager.removeObserver(cid, tag);
      }

      // console.log("vtkLocal::unmounted");
      sceneManager.stopEventLoop(props.renderWindow);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
    });

    // Public -----------------------------------------------------------------
    return {
      container,
      canvas,
      update,
      resetCamera,
    };
  },
  template: `
        <div ref="container" style="position: relative; width: 100%; height: 100%;">
          <canvas 
            id="canvas"
            ref="canvas" 
            style="position: absolute; left: 0; top: 0; width: 100%; height: 100%;" 
            tabindex="0"
            
            @contextmenu.prevent
            @click="canvas.focus()"
            @mouseenter="canvas.focus()"
          />
        </div>`,
};
