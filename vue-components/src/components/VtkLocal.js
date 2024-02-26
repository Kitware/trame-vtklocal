import { inject, ref, unref, onMounted, onBeforeUnmount } from "vue";
import { createModule } from "../utils";

export default {
  emits: ["updated"],
  props: {
    renderWindow: {
      type: String,
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
    const hashesAvailable = new Set();
    let objectManager = null;

    function resize() {
      const { width, height } = container.value.getBoundingClientRect();
      canvasWidth.value = width;
      canvasHeight.value = height;
      console.log(`vtkLocal::resize ${width}x${height}`);
      if (props.renderWindow.length > 0)
      {
        objectManager.setSize(props.renderWindow, width, height);
        objectManager.render(props.renderWindow);
      }
    }
    let resizeObserver = new ResizeObserver(resize);

    async function fetchState(vtkId) {
      const session = client.getConnection().getSession();
      const serverState = await session.call("vtklocal.get.state", [vtkId]);
      if (serverState.length > 0) {
        stateMTimes[vtkId] = JSON.parse(serverState).MTime;
        console.log(`vtkLocal::state(${vtkId})`);
        objectManager.registerState(serverState);
      }
      else {
        throw new Error(`Server returned empty state for ${vtkId}`);
      }
      return serverState;
    }
    async function fetchHash(hash) {
      const session = client.getConnection().getSession();
      const blob = await session.call("vtklocal.get.hash", [hash]);
      console.log(`vtkLocal::hash(${hash})`)
      const array = new Uint8Array(await blob.arrayBuffer());
      objectManager.registerBlob(hash, array);
      hashesAvailable.add(hash);
      return blob;
    }

    async function update(startEventLoop = false) {
      console.log("vtkLocal::update(begin)");
      const session = client.getConnection().getSession();
      const serverStatus = await session.call("vtklocal.get.status", [
        props.renderWindow,
      ]);
      const pendingRequests = [];
      console.log("ids", serverStatus.ids);
      serverStatus.ids.forEach(([vtkId, mtime]) => {
        if (!stateMTimes[vtkId] || stateMTimes[vtkId] < mtime) {
          console.log("fetch", vtkId)
          pendingRequests.push(fetchState(vtkId));
        } else {
          console.log("skip", vtkId)
        }
      });
      serverStatus.hashes.forEach((hash) => {
        if (!hashesAvailable.has(hash)) {
          pendingRequests.push(fetchHash(hash));
        }
      });
      await Promise.all(pendingRequests);
      console.log("vtkLocal::update(end)");
      objectManager.update(startEventLoop);
      resize();
      emit("updated");
    }

    onMounted(async () => {
      console.log("vtkLocal::mounted");
      objectManager = await createModule(unref(canvas));
      console.log("objectManager", objectManager);
      resizeObserver.observe(unref(container));
      update(/*startEventLoop=*/true);
      setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
    });

    onBeforeUnmount(() => {
      console.log("vtkLocal::unmounted");
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
            style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);" 
            
            tabindex="0"
            
            @contextmenu.prevent
            @click="canvas.focus()"
            
          />
        </div>`,
};
// :width="canvasWidth"
// :height="canvasHeight"
