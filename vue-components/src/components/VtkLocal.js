import { inject, ref, unref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { createModule } from "../utils";

export default {
  emits: ["updated"],
  props: {
    renderWindow: {
      type: Number,
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
      // objectManager.update();
      // window.dispatchEvent(new Event("resize"));
      // FIXME: call setSize on vtkRenderWindow
    }
    let resizeObserver = new ResizeObserver(resize);

    async function fetchState(vtkId) {
      const session = client.getConnection().getSession();
      const serverState = await session.call("vtklocal.get.state", [vtkId]);
      stateMTimes[vtkId] = serverState.mtime;
      console.log(`vtkLocal::state(${vtkId})`)
      objectManager.registerState(serverState);
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

    async function update() {
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
      objectManager.update();
      emit("updated");
    }

    onMounted(async () => {
      console.log("vtkLocal::mounted");
      objectManager = await createModule(unref(canvas));
      console.log("objectManager", objectManager);
      resizeObserver.observe(unref(container));
      update();
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
