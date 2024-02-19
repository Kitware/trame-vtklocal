import { inject, ref, unref, onMounted, onBeforeUnmount } from "vue";

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

    function resize() {
      const { width, height } = container.value.getBoundingClientRect();
      canvasWidth.value = width;
      canvasHeight.value = height;
      console.log(`vtkLocal::resize ${width}x${height}`);
      // FIXME: call setSize on vtkRenderWindow
    }
    let resizeObserver = new ResizeObserver(resize);

    async function fetchState(vtkId) {
      const session = client.getConnection().getSession();
      const serverState = await session.call("vtklocal.get.state", [vtkId]);
      stateMTimes[vtkId] = serverState.mtime;
      // FIXME: load state in wasm module
      console.log(`vtkLocal::state(${vtkId}) =`, serverState);
      return serverState;
    }
    async function fetchHash(hash) {
      const session = client.getConnection().getSession();
      const blob = await session.call("vtklocal.get.hash", [hash]);
      hashesAvailable.add(hash);
      console.log(`vtkLocal::hash(${hash})`);
      // FIXME: load hash blob in wasm module
      return blob;
    }

    async function update() {
      console.log("vtkLocal::update(begin)");
      const session = client.getConnection().getSession();
      const serverStatus = await session.call("vtklocal.get.status", [
        props.renderWindow,
      ]);
      const pendingRequests = [];
      serverStatus.ids.forEach(([vtkId, mtime]) => {
        if (!stateMTimes[vtkId] || stateMTimes[vtkId] < mtime) {
          pendingRequests.push(fetchState(vtkId));
        }
      });
      serverStatus.hashes.forEach((hash) => {
        if (!hashesAvailable.has(hash)) {
          pendingRequests.push(fetchHash(hash));
        }
      });
      await Promise.all(pendingRequests);
      // FIXME: update wasm module
      console.log("vtkLocal::update(end)");
      emit("updated");
    }

    onMounted(() => {
      console.log("vtkLocal::mounted");
      resizeObserver.observe(unref(container));
      update();
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
            ref="canvas" 
            :width="canvasWidth"
            :height="canvasHeight" 
            style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);" 
          />
        </div>`,
};
