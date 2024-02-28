import { inject, ref, unref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { createModule } from "../utils";

export default {
  emits: ["updated", "memory"],
  props: {
    renderWindow: {
      type: String,
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
    const canvasWidth = ref(300);
    const canvasHeight = ref(300);
    const container = ref(null);
    const canvas = ref(null);
    const client = props.wsClient || trame?.client;
    const stateMTimes = {};
    const hashesMTime = {};
    const currentMTime = ref(1);
    let objectManager = null;
    let updateInProgress = 0;

    function resize() {
      const { width, height } = container.value.getBoundingClientRect();
      const w = Math.floor(width * window.devicePixelRatio + 0.5);
      const h = Math.floor(height * window.devicePixelRatio + 0.5);
      canvasWidth.value = w;
      canvasHeight.value = h;
      // console.log(`vtkLocal::resize ${width}x${height}`);
      if (props.renderWindow.length > 0) {
        nextTick(() => {
          objectManager.setSize(props.renderWindow, w, h);
          objectManager.render(props.renderWindow);
        });
      }
    }
    let resizeObserver = new ResizeObserver(resize);

    async function fetchState(vtkId) {
      const session = client.getConnection().getSession();
      const serverState = await session.call("vtklocal.get.state", [vtkId]);
      if (serverState.length > 0) {
        stateMTimes[vtkId] = JSON.parse(serverState).MTime;
        // console.log(`vtkLocal::state(${vtkId})`);
        objectManager.registerState(serverState);
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
      objectManager.registerBlob(hash, array);
      // console.log(`vtkLocal::hash(${hash}) - available`);
      hashesMTime[hash] = unref(currentMTime);
      return blob;
    }

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
          objectManager.unRegisterState(vtkId);
        });
        serverStatus.hashes.forEach((hash) => {
          if (!hashesMTime[hash]) {
            pendingRequests.push(fetchHash(hash));
          }
          hashesMTime[hash] = unref(currentMTime);
        });
        await Promise.all(pendingRequests);
        try {
          objectManager.updateObjectsFromStates();
        } catch (e) {
          console.error("WASM update failed");
          console.log(e);
        }
        resize();
        emit("updated");

        // Memory management
        currentMTime.value++;
        const threshold =
          Number(props.cacheSize) +
          objectManager.getTotalVTKDataObjectMemoryUsage();
        if (objectManager.getTotalBlobMemoryUsage() > threshold) {
          // console.log("Free memory");
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
          while (objectManager.getTotalBlobMemoryUsage() > threshold) {
            const hashesToDelete = tsMap[mtimeToFree];
            if (hashesToDelete) {
              for (let i = 0; i < hashesToDelete.length; i++) {
                // console.log(
                //   `Delete hash(${hashesToDelete[i]}) - mtime: ${mtimeToFree}`
                // );
                objectManager.unRegisterBlob(hashesToDelete[i]);
                delete hashesMTime[hashesToDelete[i]];
              }
            }
            mtimeToFree++;
          }
        }
        emit("memory", {
          blobs: objectManager.getTotalBlobMemoryUsage(),
          scene: objectManager.getTotalVTKDataObjectMemoryUsage(),
        });
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

    onMounted(async () => {
      // console.log("vtkLocal::mounted");
      objectManager = await createModule(unref(canvas));
      // console.log("objectManager", objectManager);
      resizeObserver.observe(unref(container));
      update().then(() => {
        canvasWidth.value = 300;
        canvasHeight.value = 300;
        objectManager.startEventLoop(props.renderWindow);
        nextTick(resize);
      });
    });

    onBeforeUnmount(() => {
      // console.log("vtkLocal::unmounted");
      objectManager.stopEventLoop(props.renderWindow);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
    });

    return {
      container,
      canvas,
      update,
      canvasWidth,
      canvasHeight,
    };
  },
  template: `
        <div ref="container" style="position: relative; width: 100%; height: 100%;">
          <canvas 
            id="canvas"
            ref="canvas" 
            style="position: absolute; left: 0; top: 0; width: 100%; height: 100%;" 
            :width="canvasWidth"
            :height="canvasHeight"
            tabindex="0"
            
            @contextmenu.prevent
            @click="canvas.focus()"
            
          />
        </div>`,
};
