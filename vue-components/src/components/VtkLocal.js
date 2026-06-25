import {
  computed,
  inject,
  ref,
  reactive,
  unref,
  onBeforeMount,
  onMounted,
  onBeforeUnmount,
  toRef,
  watchEffect,
  watch,
} from "vue";

import "@kitware/vtk-wasm/style.css";
import { loadAsync } from "@kitware/vtk-wasm";

import {
  debounce,
  bindNetwork,
  createExtractCallback,
  generateNextCanvasId,
  createFuture,
} from "../utils";

const WASM_RUNTIMES = {};
const WASM_REMOTE_SESSIONS = {};

function disposeRemoteSession(runtimeId) {
  if (!runtimeId) {
    const ids = Object.keys(WASM_REMOTE_SESSIONS);
    ids.forEach(disposeRemoteSession);
    return ids.length > 0;
  }
  if (WASM_REMOTE_SESSIONS[runtimeId]) {
    console.log("Removing remote session for wasm runtime", runtimeId);
    WASM_REMOTE_SESSIONS[runtimeId].dispose();
    delete WASM_REMOTE_SESSIONS[runtimeId];
    return true;
  }
  return false;
}

function disposeWasmRuntime(runtimeId) {
  if (!runtimeId) {
    const ids = Object.keys(WASM_RUNTIMES);
    ids.forEach(disposeWasmRuntime);
    return ids.length > 0;
  }
  disposeRemoteSession(runtimeId);
  if (WASM_RUNTIMES[runtimeId]) {
    console.log("Removing wasm runtime with ID:", runtimeId);
    WASM_RUNTIMES[runtimeId].dispose();
    delete WASM_RUNTIMES[runtimeId];
    return true;
  }
  return false;
}

if (window.trame.refs) {
  window.trame.refs.vtkWASM = {
    disposeRemoteSession,
    disposeWasmRuntime,
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
    "ready",
    "unmount",
  ],
  props: {
    progressEnabled: {
      type: Boolean,
    },
    progressDelay: {
      type: Number,
      default: 500,
    },
    renderWindow: {
      type: Number,
      default: 0,
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
    emitMemory: {
      type: Boolean,
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
    autoResize: {
      type: Boolean,
      default: true,
    },
  },
  setup(props, { emit }) {
    // Local ------------------------------------------------------------------

    let remoteSession = null;
    let removeProgressCallback = null;
    const cameraTags = [];
    const listenersTags = [];
    const wasmFuture = createFuture();

    // Vue.js -----------------------------------------------------------------
    const canvasId = generateNextCanvasId();
    const wasmRuntime = ref(null);
    const wasmLoading = ref(true);
    const container = ref(null);
    const canvas = ref(null);
    const listeners = toRef(props, "listeners");
    const progress = reactive({
      active: false,
      tsStart: 0,
      tsNow: 0,
      state: {
        current: 0,
        total: 0,
      },
      hash: {
        current: 0,
        total: 0,
      },
    });
    const showLoading = computed(
      () =>
        props.progressEnabled &&
        progress.tsNow - progress.tsStart > props.progressDelay &&
        progress.active,
    );
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

    // trame ------------------------------------------------------------------

    const trame = inject("trame");
    const client = unref(props.wsClient) || trame?.client;
    const bits = props.config?.mode || "wasm32";
    const { url, wasmBaseName } = trame.state.get(`__trame_vtklocal_${bits}`);

    // wasm -------------------------------------------------------------------
    function hasRemoteSession() {
      if (!remoteSession || remoteSession.disposed) {
        return false;
      }
      return true;
    }

    onBeforeMount(async () => {
      try {
        const runtime = await loadAsync({
          url,
          wasmBaseName,
          urlIsGzip: false,
          ...props.config,
        });
        WASM_RUNTIMES[runtime.id] = runtime;
        if (!WASM_REMOTE_SESSIONS[runtime.id]) {
          WASM_REMOTE_SESSIONS[runtime.id] = runtime.createRemoteSession();
        }
        remoteSession = WASM_REMOTE_SESSIONS[runtime.id];
        bindNetwork(client, remoteSession);

        // Connect progress
        removeProgressCallback = remoteSession.addProgressCallback(
          (payload) => {
            if (!payload) {
              return;
            }
            progress.tsNow = Date.now();
            if (!progress.active && payload.active) {
              progress.tsStart = progress.tsNow;
            }
            progress.active = !!payload.active;
            progress.state.current = payload.state?.current || 0;
            progress.state.total = payload.state?.total || 0;
            progress.hash.current = payload.hash?.current || 0;
            progress.hash.total = payload.hash?.total || 0;
            emit("progress", {
              active: progress.active,
              elapsed: progress.tsNow - progress.tsStart,
              state: {
                current: progress.state.current,
                total: progress.state.total,
              },
              hash: {
                current: progress.hash.current,
                total: progress.hash.total,
              },
            });
          },
        );

        // Activate component
        wasmRuntime.value = runtime.id;
        wasmFuture.resolve();
      } catch (error) {
        wasmFuture.reject(error);
      }
    });

    // Eager state synchronization --------------------------------------------

    if (props.eagerSync) {
      const rpcSession = client.getConnection().getSession();
      const subscription = rpcSession.subscribe(
        "vtklocal.subscriptions",
        ([event]) => {
          if (!hasRemoteSession()) return;
          if (event.type === "state") {
            remoteSession.patchState(event.content);
          }
          if (event.type === "blob") {
            remoteSession.pushHash(event.hash, event.content);
          }
        },
      );
      onBeforeUnmount(async () => {
        rpcSession.unsubscribe(subscription);
        if (props.renderWindow > 0) {
          await rpcSession.call("vtklocal.subscribe.update", [
            props.renderWindow,
            -1,
          ]);
        }
      });
      watch(
        () => props.renderWindow,
        async (newId, oldId) => {
          if (oldId > 0) {
            await rpcSession.call("vtklocal.subscribe.update", [oldId, -1]);
          }
          if (newId > 0) {
            await rpcSession.call("vtklocal.subscribe.update", [newId, +1]);
          }
        },
        { immediate: true },
      );
    }

    // Logger verbosity synchronization ---------------------------------------

    watchEffect(() => {
      const settings = props.verbosity;
      if (!wasmRuntime.value || !hasRemoteSession()) return;

      if (
        settings.objectManager &&
        remoteSession.native.setObjectManagerLogVerbosity
      ) {
        remoteSession.native.setObjectManagerLogVerbosity(
          settings.objectManager,
        );
      }
      if (settings.invoker && remoteSession.native.setInvokerLogVerbosity) {
        remoteSession.native.setInvokerLogVerbosity(settings.invoker);
      }
      if (
        settings.deserializer &&
        remoteSession.native.setDeserializerLogVerbosity
      ) {
        remoteSession.native.setDeserializerLogVerbosity(settings.deserializer);
      }
      if (
        settings.serializer &&
        remoteSession.native.setSerializerLogVerbosity
      ) {
        remoteSession.native.setSerializerLogVerbosity(settings.serializer);
      }
    });

    // Resize -----------------------------------------------------------------

    const resize = debounce(async () => {
      if (!hasRemoteSession()) return;
      const { width, height } = container.value.getBoundingClientRect();
      const w = Math.floor(width * window.devicePixelRatio + 0.5);
      const h = Math.floor(height * window.devicePixelRatio + 0.5);
      await remoteSession.setSizeAsync(props.renderWindow, w, h);
    }, 100);

    let resizeObserver = props.autoResize && new ResizeObserver(resize);

    // Memory -----------------------------------------------------------------

    function checkMemory() {
      if (!hasRemoteSession()) return;

      remoteSession.freeMemory(props.cacheSize);
      if (!props.emitMemory) return;
      emit(
        "memory-vtk",
        Number(remoteSession.native.getTotalVTKDataObjectMemoryUsage()),
      );
      emit(
        "memory-arrays",
        Number(remoteSession.native.getTotalBlobMemoryUsage()),
      );
    }

    // Update -----------------------------------------------------------------

    async function update(options) {
      if (!hasRemoteSession()) return;

      await remoteSession.updateAsync(props.renderWindow);
      emit("updated", options);
      checkMemory();
    }

    // render / resetCamera ---------------------------------------------------

    function render() {
      if (!hasRemoteSession()) return;

      remoteSession.native.render(props.renderWindow);
    }

    function resetCamera(rendererId) {
      if (!hasRemoteSession()) return;

      remoteSession.native.resetCamera(rendererId);
      remoteSession.native.render(props.renderWindow);
    }

    // invoke ------------------------------------------------------------

    async function invoke(objId, method, args) {
      if (!hasRemoteSession()) return;

      const result = await remoteSession.native.invoke(objId, method, args);

      // Extract object state if object is returned
      if (result?.Id && result?.Success) {
        result.Value = remoteSession.getState(result.Id);
      }

      emit("invoke-response", result);

      return result;
    }

    // debug ------------------------------------------------------------

    function printSceneManagerInformation() {
      if (!hasRemoteSession()) return;

      remoteSession.native.printSceneManagerInformation();
    }

    // startWebXR ----------------------------------------------------------------

    function startWebXR(mode, requiredFeatures, optionalFeatures) {
      if (!hasRemoteSession()) return;

      remoteSession.native.startWebXR(mode, requiredFeatures, optionalFeatures);
    }

    // stopWebXR ----------------------------------------------------------------

    function stopWebXR() {
      if (!hasRemoteSession()) return;

      remoteSession.native.stopWebXR();
    }

    // Life Cycles ------------------------------------------------------------

    onMounted(async () => {
      // Wait for wasm to be fully loaded
      await wasmFuture.promise;

      // Should never happen
      if (!hasRemoteSession()) {
        throw new Error(
          "LocalView is mounting but the remote session is not valid.",
        );
      }

      // Bind canvas to renderWindow
      remoteSession.bindCanvas(props.renderWindow, unref(canvas));

      // Figure out size
      if (resizeObserver) {
        resizeObserver.observe(unref(container));
      }
      await update({ onMounted: props.renderWindow });
      wasmLoading.value = false;
      // Camera listener
      remoteSession.cameraIds.forEach((cid) => {
        try {
          cameraTags.push([
            cid,
            remoteSession.native.observe(cid, "ModifiedEvent", () => {
              emit("camera", remoteSession.getState(cid));
            }),
          ]);
        } catch (err) {
          console.error("wasm64 has issue with observer", err);
        }
      });
      // Attach listeners
      watchEffect(() => {
        // register tracking
        const allListeners = listeners.value || {};

        // Exit on disposed session
        if (!hasRemoteSession()) return;

        while (listenersTags.length) {
          const [cid, tag] = listenersTags.pop();
          remoteSession.native.unObserve(cid, tag);
        }
        for (const [cid, eventMap] of Object.entries(allListeners)) {
          const wasmId = Number(cid);
          for (const [eventName, extractInfo] of Object.entries(
            eventMap || {},
          )) {
            const fn = createExtractCallback(trame, remoteSession, extractInfo);
            listenersTags.push([
              wasmId,
              remoteSession.native.observe(wasmId, eventName, fn),
            ]);
            // Push update at registration
            fn();
          }
        }
      });

      // Start event loop
      if (!remoteSession.startEventLoop(props.renderWindow)) {
        console.error("Could not startEventLoop for", props.renderWindow);
      }

      // trigger an emit right away
      remoteSession.cameraIds.forEach((cid) => {
        emit("camera", remoteSession.getState(cid));
      });

      // Send ready event with WASM Runtime Id
      emit("ready", wasmRuntime.value);
    });

    onBeforeUnmount(async () => {
      emit("unmount");

      // Remove progress tracking
      removeProgressCallback && removeProgressCallback();

      // Remove size observer
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }

      // Exit if already disposed
      if (!hasRemoteSession()) return;

      // Camera listeners
      while (cameraTags.length) {
        const [cid, tag] = cameraTags.pop();
        remoteSession.native.unObserve(cid, tag);
      }
      while (listenersTags.length) {
        const [cid, tag] = listenersTags.pop();
        remoteSession.native.unObserve(cid, tag);
      }

      // Cleanup our view in wasm session
      const rwId = props.renderWindow;
      remoteSession.stopEventLoop(rwId);
      remoteSession.unbindCanvas(rwId);
      await remoteSession.native.invoke(rwId, "Finalize", []);
    });

    // Public -----------------------------------------------------------------

    function evalStateExtract(definition) {
      createExtractCallback(trame, remoteSession, definition)();
    }

    function getVtkObject(vtkId) {
      return remoteSession.getVtkObject(vtkId);
    }

    /**
     * dispose WASM remoteSession
     */
    function disposeRemoteSession(runtimeId) {
      const rId = runtimeId || wasmRuntime.value;
      if (WASM_REMOTE_SESSIONS[rId]) {
        console.log("Removing remote session for wasm runtime", rId);
        WASM_REMOTE_SESSIONS[rId].dispose();
        delete WASM_REMOTE_SESSIONS[rId];
      }
    }
    /**
     * dispose wasm runtime
     */
    function disposeWasmRuntime(runtimeId) {
      const rId = runtimeId || wasmRuntime.value;
      disposeRemoteSession(rId);
      if (WASM_RUNTIMES[rId]) {
        console.log("Removing wasm runtime with ID:", rId);
        WASM_RUNTIMES[rId].dispose();
        delete WASM_RUNTIMES[rId];
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
      printSceneManagerInformation,
      disposeRemoteSession,
      disposeWasmRuntime,
      getVtkObject,
      progress,
      showLoading,
      statePercent,
      hashPercent,
      wasmLoading,
      startWebXR,
      stopWebXR,
      canvas,
      canvasId,
    };
  },
  template: `<div ref="container" style="position: relative; width: 100%; height: 100%;">
    <canvas :id="canvasId" ref="canvas" tab="-1" style="position:absolute;top:0;left:0;width:100%;height:100%;" />
    <slot
      v-if="showLoading"
      name="loader"
      :progress="progress"
      :wasm-loading="wasmLoading"
      :state-percent="statePercent"
      :hash-percent="hashPercent"
      :show-loading="showLoading"
    >
      <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(10, 10, 10, 0.45); z-index: 2;">
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
    </slot>
  </div>`,
};
