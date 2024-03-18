import { inject, ref, unref, onMounted, onBeforeUnmount } from "vue";
import { createModule } from "../utils";

export default {
  emits: ["updated", "memory-vtk", "memory-arrays"],
  props: {
    renderWindow: {
      type: Number,
    },
    cacheSize: {
      type: Number,
      default: 100000000,
    },
    wsClient: {
      type: Object,
    },
  },
  setup(props, { emit }) {
    const trame = inject("trame");
    const wasmFile = trame.state.get("__trame_vtklocal_wasm_name");
    const container = ref(null);
    const canvas = ref(null);
    const client = props.wsClient || trame?.client;
    const stateMTimes = {};
    const hashesMTime = {};
    const currentMTime = ref(1);
    let sceneManager = null;
    let updateInProgress = 0;

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
      const session = client.getConnection().getSession();
      // console.log(`vtkLocal::hash(${hash}) - before`);
      const blob = await session.call("vtklocal.get.hash", [hash]);
      const array = new Uint8Array(await blob.arrayBuffer());
      sceneManager.registerBlob(hash, array);
      // console.log(`vtkLocal::hash(${hash}) - available`);
      hashesMTime[hash] = unref(currentMTime);
      return blob;
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

    // Life Cycles ------------------------------------------------------------

    onMounted(async () => {
      // console.log("vtkLocal::mounted");
      sceneManager = await createModule(unref(canvas), wasmFile);
      await update();
      // sceneManager.addObserver(props.renderWindow, "StartEvent", (id, eventName) => {
      //   eventName = sceneManager.UTF8ToString(eventName);
      //   console.log(`${eventName} emitted from ${id}`);
      // });
      // sceneManager.addObserver(props.renderWindow, "EndEvent", () => { console.log("vtkRenderWindow EndEvent"); });
      sceneManager.startEventLoop(props.renderWindow);
      if (resizeObserver) {
        resizeObserver.observe(unref(container));
      }
    });

    onBeforeUnmount(() => {
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
