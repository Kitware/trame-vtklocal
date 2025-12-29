import {
  computed,
  inject,
  ref,
  reactive,
  unref,
  onMounted,
  onBeforeUnmount,
  toRef,
  watchEffect,
} from "vue";

import "@kitware/vtk-wasm/style.css";
import { RemoteSession } from "@kitware/vtk-wasm/remote";

const WASM_HANDLERS = {};

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
  emits: [
    "updated",
    "memory-vtk",
    "memory-arrays",
    "camera",
    "invoke-response",
    "progress",
  ],
  props: {
    useHandler: {
      type: String,
    },
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
    verbosity: {
      type: Object,
      default: () => ({
        // "INFO", "WARNING", "TRACE", "ERROR"
        objectManager: null,
        invoker: null,
        deserializer: null,
        serializer: null,
      }),
    },
    config: {
      type: Object,
      default: () => ({
        rendering: "webgl",
        exec: "sync",
      }),
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
    // Create global WASM handler if missing
    if (props.useHandler && !WASM_HANDLERS[props.useHandler]) {
      WASM_HANDLERS[props.useHandler] = new RemoteSession();
    }

    const trame = inject("trame");
    const wasmURL = trame.state.get("__trame_vtklocal_wasm_url");
    const wasmBaseName = trame.state.get("__trame_vtklocal_wasm_base_name");
    const cameraTags = [];
    const listenersTags = [];
    const container = ref(null);
    const client = props.wsClient || trame?.client;
    const listeners = toRef(props, "listeners");
    const wasmManager = props.useHandler
      ? WASM_HANDLERS[props.useHandler]
      : new RemoteSession();
    let subscription = null;
    const progress = reactive({
      active: false,
      state: {
        current: 0,
        total: 0,
      },
      hash: {
        current: 0,
        total: 0,
      },
    });
    const wasmLoading = ref(!wasmManager.loaded);
    const showLoading = computed(() => wasmLoading.value || progress.active);
    const statePercent = computed(() => {
      if (!progress.state.total) {
        return 0;
      }
      return Math.min(
        100,
        Math.floor((progress.state.current / progress.state.total) * 100),
      );
    });
    const hashPercent = computed(() => {
      if (!progress.hash.total) {
        return 0;
      }
      return Math.min(
        100,
        Math.floor((progress.hash.current / progress.hash.total) * 100),
      );
    });
    function updateProgress(payload) {
      if (!payload) {
        return;
      }
      progress.active = !!payload.active;
      progress.state.current = payload.state?.current || 0;
      progress.state.total = payload.state?.total || 0;
      progress.hash.current = payload.hash?.current || 0;
      progress.hash.total = payload.hash?.total || 0;
      emit("progress", {
        active: progress.active,
        state: {
          current: progress.state.current,
          total: progress.state.total,
        },
        hash: {
          current: progress.hash.current,
          total: progress.hash.total,
        },
      });
    }
    let removeProgressCallback = null;
    if (wasmManager.addProgressCallback) {
      removeProgressCallback = wasmManager.addProgressCallback(updateProgress);
    }

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

    async function resize() {
      const { width, height } = container.value.getBoundingClientRect();
      const w = Math.floor(width * window.devicePixelRatio + 0.5);
      const h = Math.floor(height * window.devicePixelRatio + 0.5);
      await wasmManager.setSize(props.renderWindow, w, h);
    }
    let resizeObserver = new ResizeObserver(resize);

    // Memory -----------------------------------------------------------------

    function checkMemory() {
      wasmManager.freeMemory(props.cacheSize);
      emit(
        "memory-vtk",
        wasmManager.sceneManager.getTotalVTKDataObjectMemoryUsage(),
      );
      emit("memory-arrays", wasmManager.sceneManager.getTotalBlobMemoryUsage());
    }

    // Update -----------------------------------------------------------------

    async function update(bindCanvas = false) {
      if (!wasmManager.loaded) {
        return;
      }

      await wasmManager.update(props.renderWindow, bindCanvas);
      emit("updated");
      checkMemory();
    }

    // resetCamera ------------------------------------------------------------

    function resetCamera(rendererId) {
      wasmManager.sceneManager.resetCamera(rendererId);
      wasmManager.sceneManager.render(props.renderWindow);
    }

    // render ------------------------------------------------------------

    function render() {
      wasmManager.sceneManager.render(props.renderWindow);
    }

    // invoke ------------------------------------------------------------

    async function invoke(objId, method, args) {
      const result = await wasmManager.sceneManager.invoke(objId, method, args);

      // Extract object state if object is returned
      if (result?.Id && result?.Success) {
        result.Value = wasmManager.getState(result.Id);
      }

      emit("invoke-response", result);

      return result;
    }

    // debug ------------------------------------------------------------

    function printSceneManagerInformation() {
      wasmManager.sceneManager.printSceneManagerInformation();
    }

    // Life Cycles ------------------------------------------------------------

    onMounted(async () => {
      // console.log("vtkLocal::mounted");
      wasmManager.bindNetwork(netFetchState, netFetchBlob, netFetchStatus);
      if (!wasmManager.loaded) {
        wasmLoading.value = true;
        try {
          await wasmManager.load(wasmURL, props.config, wasmBaseName);
        } finally {
          wasmLoading.value = false;
        }
      }
      const selector = wasmManager.bindCanvasToDOM(
        props.renderWindow,
        unref(container),
      );
      unref(container)
        .querySelector(selector)
        .setAttribute(
          "style",
          "position: absolute; left: 0; top: 0; width: 100%; height: 100%;",
        );
      if (props.eagerSync) {
        subscribe();
      }

      // Figure out size
      if (resizeObserver) {
        resizeObserver.observe(unref(container));
      }

      // Update loggers
      watchEffect(() => {
        const settings = props.verbosity;
        if (
          settings.objectManager &&
          wasmManager.sceneManager.setObjectManagerLogVerbosity
        ) {
          wasmManager.sceneManager.setObjectManagerLogVerbosity(
            settings.objectManager,
          );
        }
        if (
          settings.invoker &&
          wasmManager.sceneManager.setInvokerLogVerbosity
        ) {
          wasmManager.sceneManager.setInvokerLogVerbosity(settings.invoker);
        }
        if (
          settings.deserializer &&
          wasmManager.sceneManager.setDeserializerLogVerbosity
        ) {
          wasmManager.sceneManager.setDeserializerLogVerbosity(
            settings.deserializer,
          );
        }
        if (
          settings.serializer &&
          wasmManager.sceneManager.setSerializerLogVerbosity
        ) {
          wasmManager.sceneManager.setSerializerLogVerbosity(
            settings.serializer,
          );
        }
      });

      await update(true);

      // Camera listener
      if (wasmManager.sceneManager.addObserver) {
        // Old API - before vtk 9.5
        wasmManager.cameraIds.forEach((cid) => {
          cameraTags.push([
            cid,
            wasmManager.sceneManager.addObserver(cid, "ModifiedEvent", () => {
              emit("camera", wasmManager.getState(cid));
            }),
          ]);
        });
      } else {
        // New API - starting with vtk 9.5
        wasmManager.cameraIds.forEach((cid) => {
          cameraTags.push([
            cid,
            wasmManager.sceneManager.observe(cid, "ModifiedEvent", () => {
              emit("camera", wasmManager.getState(cid));
            }),
          ]);
        });
      }

      // Attach listeners
      watchEffect(() => {
        if (wasmManager.sceneManager.removeObserver) {
          // Old API - before vtk 9.5
          while (listenersTags.length) {
            const [cid, tag] = listenersTags.pop();
            wasmManager.sceneManager.removeObserver(cid, tag);
          }

          for (const [cid, eventMap] of Object.entries(listeners.value || {})) {
            const wasmId = Number(cid);
            for (const [eventName, extractInfo] of Object.entries(
              eventMap || {},
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
        } else {
          // New API - starting with vtk 9.5
          while (listenersTags.length) {
            const [cid, tag] = listenersTags.pop();
            wasmManager.sceneManager.unObserve(cid, tag);
          }

          for (const [cid, eventMap] of Object.entries(listeners.value || {})) {
            const wasmId = Number(cid);
            for (const [eventName, extractInfo] of Object.entries(
              eventMap || {},
            )) {
              const fn = createExtractCallback(trame, wasmManager, extractInfo);
              listenersTags.push([
                wasmId,
                wasmManager.sceneManager.observe(wasmId, eventName, fn),
              ]);

              // Push update at registration
              fn();
            }
          }
        }
      });

      if (!wasmManager.sceneManager.startEventLoop(props.renderWindow)) {
        console.error("Could not startEventLoop for", props.renderWindow);
      }

      // trigger an emit right away
      wasmManager.cameraIds.forEach((cid) => {
        emit("camera", wasmManager.getState(cid));
      });
    });

    onBeforeUnmount(() => {
      if (subscription) {
        unsubscribe();
      }
      if (removeProgressCallback) {
        removeProgressCallback();
        removeProgressCallback = null;
      }

      // Old/New API - detection
      const removeObserverMethodName = wasmManager.sceneManager.removeObserver
        ? "removeObserver"
        : "unObserve";

      // Camera listeners
      while (cameraTags.length) {
        const [cid, tag] = cameraTags.pop();
        wasmManager.sceneManager[removeObserverMethodName](cid, tag);
      }
      while (listenersTags.length) {
        const [cid, tag] = listenersTags.pop();
        wasmManager.sceneManager[removeObserverMethodName](cid, tag);
      }

      // console.log("vtkLocal::unmounted");
      wasmManager.sceneManager.stopEventLoop(props.renderWindow);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }

      // unbind canvas
      wasmManager.unbindCanvasToDOM(props.renderWindow);
    });

    // Public -----------------------------------------------------------------

    function evalStateExtract(definition) {
      createExtractCallback(trame, wasmManager, definition)();
    }

    function getVtkObject(vtkId) {
      return wasmManager.getVtkObject(vtkId);
    }

    /**
     * Remove WASM handler from global map to free memory once component unmount.
     */
    function detachHandler() {
      if (props.useHandler && WASM_HANDLERS[props.useHandler]) {
        delete WASM_HANDLERS[props.useHandler];
      }
    }

    return {
      container,
      update,
      resetCamera,
      render,
      evalStateExtract,
      invoke,
      resize,
      wasmManager,
      printSceneManagerInformation,
      detachHandler,
      getVtkObject,
      progress,
      showLoading,
      statePercent,
      hashPercent,
      wasmLoading,
    };
  },
  template: `<div ref="container" style="position: relative; width: 100%; height: 100%;">
    <div v-if="showLoading" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(10, 10, 10, 0.45); z-index: 2;">
      <div style="min-width: 220px; max-width: 320px; padding: 12px 14px; border-radius: 8px; background: rgba(20, 20, 20, 0.9); color: #f5f5f5;">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">
          {{ wasmLoading ? "Loading VTK WASM" : "Syncing VTK Data" }}
        </div>
        <div v-if="wasmLoading" style="font-size: 12px; opacity: 0.85;">
          Fetching WebAssembly bundle...
        </div>
        <div v-else>
          <div style="margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; opacity: 0.8;">
              <span>States</span>
              <span>{{ progress.state.current }}/{{ progress.state.total }}</span>
            </div>
            <div style="height: 6px; background: rgba(255, 255, 255, 0.15); border-radius: 4px; overflow: hidden;">
              <div :style="{ width: statePercent + '%', height: '100%', background: '#4aa3ff' }"></div>
            </div>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; opacity: 0.8;">
              <span>Blobs</span>
              <span>{{ progress.hash.current }}/{{ progress.hash.total }}</span>
            </div>
            <div style="height: 6px; background: rgba(255, 255, 255, 0.15); border-radius: 4px; overflow: hidden;">
              <div :style="{ width: hashPercent + '%', height: '100%', background: '#f5c542' }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`,
};
