import {
  inject,
  ref,
  unref,
  onMounted,
  onBeforeUnmount,
  toRef,
  watchEffect,
} from "vue";
import { VtkWASMHandler } from "../core";

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
    const cameraTags = [];
    const listenersTags = [];
    const container = ref(null);
    const canvas = ref(null);
    const client = props.wsClient || trame?.client;
    const listeners = toRef(props, "listeners");
    const wasmManager = new VtkWASMHandler();
    let subscription = null;

    // network connector ------------------------------------------------------

    async function netFetchState(vtkId) {
      const session = client.getConnection().getSession();
      return await session.call("vtklocal.get.state", [vtkId]);
    }

    async function netFetchBlob(hash) {
      const session = client.getConnection().getSession();
      const content = await session.call("vtklocal.get.hash", [hash]);
      // handle either blob or TypedArray
      const array = content.arrayBuffer
        ? new Uint8Array(await content.arrayBuffer())
        : content;
      return array;
    }

    async function netFetchStatus(vtkId) {
      const session = client.getConnection().getSession();
      return await session.call("vtklocal.get.status", [vtkId]);
    }

    // Subscription handling --------------------------------------------------

    function handleMessage([event]) {
      if (event.type === "state") {
        wasmManager.pushState(event.content);
      }
      if (event.type === "blob") {
        wasmManager.pushHash(event.hash, event.content);
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
      if (canvasDOM && wasmManager.loaded && props.renderWindow) {
        canvasDOM.width = w;
        canvasDOM.height = h;
        // console.log(`vtkLocal::resize ${width}x${height}`);
        wasmManager.sceneManager.setSize(props.renderWindow, w, h);
        wasmManager.sceneManager.render(props.renderWindow);
      }
    }
    let resizeObserver = new ResizeObserver(resize);

    // Memory -----------------------------------------------------------------

    function checkMemory() {
      wasmManager.freeMemory(props.cacheSize);
      emit(
        "memory-vtk",
        wasmManager.sceneManager.getTotalVTKDataObjectMemoryUsage()
      );
      emit("memory-arrays", wasmManager.sceneManager.getTotalBlobMemoryUsage());
    }

    // Update -----------------------------------------------------------------

    async function update() {
      if (!wasmManager.loaded) {
        return;
      }

      await wasmManager.update(props.renderWindow);
      wasmManager.sceneManager.render(props.renderWindow);
      resize();
      emit("updated");
      checkMemory();
    }

    // resetCamera ------------------------------------------------------------

    function resetCamera(rendererId) {
      wasmManager.sceneManager.resetCamera(rendererId);
      wasmManager.sceneManager.render(props.renderWindow);
    }

    // Life Cycles ------------------------------------------------------------

    onMounted(async () => {
      // console.log("vtkLocal::mounted");
      wasmManager.bindNetwork(netFetchState, netFetchBlob, netFetchStatus);
      await wasmManager.load(wasmURL, unref(canvas));
      if (props.eagerSync) {
        subscribe();
      }
      await update();

      // Camera listener
      wasmManager.cameraIds.forEach((cid) => {
        cameraTags.push([
          cid,
          wasmManager.sceneManager.addObserver(cid, "ModifiedEvent", () => {
            emit("camera", wasmManager.getState(cid));
          }),
        ]);
      });

      // Attach listeners
      watchEffect(() => {
        while (listenersTags.length) {
          const [cid, tag] = listenersTags.pop();
          wasmManager.sceneManager.removeObserver(cid, tag);
        }

        for (const [cid, eventMap] of Object.entries(listeners.value || {})) {
          const wasmId = Number(cid);
          for (const [eventName, extractInfo] of Object.entries(
            eventMap || {}
          )) {
            const fn = createExtractCallback(trame, wasmManager, extractInfo);
            listenersTags.push([
              wasmId,
              wasmManager.sceneManager.addObserver(wasmId, eventName, fn),
            ]);

            // Push update at registration
            fn();
          }
        }
      });

      wasmManager.sceneManager.startEventLoop(props.renderWindow);
      if (resizeObserver) {
        resizeObserver.observe(unref(container));
      }
    });

    onBeforeUnmount(() => {
      if (subscription) {
        unsubscribe();
      }

      // Camera listeners
      while (cameraTags.length) {
        const [cid, tag] = cameraTags.pop();
        wasmManager.sceneManager.removeObserver(cid, tag);
      }
      while (listenersTags.length) {
        const [cid, tag] = listenersTags.pop();
        wasmManager.sceneManager.removeObserver(cid, tag);
      }

      // console.log("vtkLocal::unmounted");
      wasmManager.sceneManager.stopEventLoop(props.renderWindow);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
    });

    // Public -----------------------------------------------------------------

    function evalStateExtract(definition) {
      createExtractCallback(trame, wasmManager, definition)();
    }

    return {
      container,
      canvas,
      update,
      resetCamera,
      evalStateExtract,
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
