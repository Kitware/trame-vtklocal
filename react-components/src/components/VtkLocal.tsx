import type React from "react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import "@kitware/vtk-wasm/style.css";
import { loadAsync } from "@kitware/vtk-wasm";

import {
  bindNetwork,
  createExtractCallback,
  createFuture,
  debounce,
  generateNextCanvasId,
} from "../utils";

type AnyProps = Record<string, any>;

const WASM_RUNTIMES: Record<string, any> = {};
const WASM_REMOTE_SESSIONS: Record<string, any> = {};

function disposeRemoteSessionGlobal(runtimeId?: string): boolean {
  if (!runtimeId) {
    const ids = Object.keys(WASM_REMOTE_SESSIONS);
    ids.forEach(disposeRemoteSessionGlobal);
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

function disposeWasmRuntimeGlobal(runtimeId?: string): boolean {
  if (!runtimeId) {
    const ids = Object.keys(WASM_RUNTIMES);
    ids.forEach(disposeWasmRuntimeGlobal);
    return ids.length > 0;
  }
  disposeRemoteSessionGlobal(runtimeId);
  if (WASM_RUNTIMES[runtimeId]) {
    console.log("Removing wasm runtime with ID:", runtimeId);
    WASM_RUNTIMES[runtimeId].dispose();
    delete WASM_RUNTIMES[runtimeId];
    return true;
  }
  return false;
}

if (window.trame?.refs) {
  window.trame.refs.vtkWASM = {
    disposeRemoteSession: disposeRemoteSessionGlobal,
    disposeWasmRuntime: disposeWasmRuntimeGlobal,
  };
}

// trame contract: events arrive as on<Name> props ("memory-vtk" -> onMemoryVtk)
function makeEmitter(propsRef: { current: AnyProps }) {
  return (name: string, payload?: unknown) => {
    const key = `on${name
      .split(/[-_:]/)
      .map((p: string) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("")}`;
    propsRef.current[key]?.(payload);
  };
}

function percent(part: { current?: number; total?: number }): number {
  if (!part.total) return 0;
  return Math.min(
    100,
    Math.floor(((part.current || 0) / part.total) * 100),
  );
}

function Loader({
  wasmLoading,
  progress,
}: {
  wasmLoading: boolean;
  progress: any;
}) {
  const statePercent = percent(progress.state);
  const hashPercent = percent(progress.hash);
  const barWrap: React.CSSProperties = {
    height: "6px",
    background: "rgba(255, 255, 255, 0.15)",
    borderRadius: "4px",
    overflow: "hidden",
  };
  const label: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "11px",
    marginBottom: "4px",
    opacity: 0.8,
  };
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10, 10, 10, 0.45)",
        zIndex: 2,
      }}
    >
      <div
        style={{
          minWidth: "220px",
          maxWidth: "320px",
          padding: "12px 14px",
          borderRadius: "8px",
          background: "rgba(20, 20, 20, 0.9)",
          color: "#f5f5f5",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "8px",
          }}
        >
          {wasmLoading ? "Loading VTK WASM" : "Syncing VTK Data"}
        </div>
        {wasmLoading ? (
          <div style={{ fontSize: "12px", opacity: 0.85 }}>
            Fetching WebAssembly bundle...
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: "10px" }}>
              <div style={label}>
                <span>States</span>
                <span>
                  {progress.state.current}/{progress.state.total}
                </span>
              </div>
              <div style={barWrap}>
                <div
                  style={{
                    width: `${statePercent}%`,
                    height: "100%",
                    background: "#4aa3ff",
                  }}
                />
              </div>
            </div>
            <div>
              <div style={label}>
                <span>Blobs</span>
                <span>
                  {progress.hash.current}/{progress.hash.total}
                </span>
              </div>
              <div style={barWrap}>
                <div
                  style={{
                    width: `${hashPercent}%`,
                    height: "100%",
                    background: "#f5c542",
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const VtkLocal = forwardRef<any, AnyProps>(function VtkLocal(props, ref) {
  const {
    progressEnabled,
    progressDelay = 500,
    cacheSize = 100000000,
    wsClient,
    verbosity,
    listeners,
    autoResize = true,
    config = { rendering: "webgl", exec: "sync", mode: "wasm32" },
    trame: trameProp,
    slot,
  } = props;
  const renderWindow = props.renderWindow ?? props["render-window"] ?? 0;
  const trame = trameProp || window.trame;
  const client = wsClient || trame?.client;

  const container = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const ctx = useRef<any>(null);
  const propsRef = useRef<AnyProps>(props);
  propsRef.current = props;
  const [wasmLoading, setWasmLoading] = useState(true);
  const [progressTick, setProgressTick] = useState(0);
  void progressTick;

  // one-time construction
  useEffect(() => {
    const emit = makeEmitter(propsRef);
    const canvasId = generateNextCanvasId();
    (canvas.current as HTMLCanvasElement).id = canvasId;

    const context: any = {
      remoteSession: null,
      cameraTags: [],
      listenersTags: [],
      progress: {
        active: false,
        tsStart: 0,
        tsNow: 0,
        state: { current: 0, total: 0 },
        hash: { current: 0, total: 0 },
      },
      wasmRuntimeId: null,
      disposed: false,
    };
    ctx.current = context;

    const hasRemoteSession = () =>
      context.remoteSession && !context.remoteSession.disposed;
    context.hasRemoteSession = hasRemoteSession;

    const bits = config?.mode || "wasm32";
    const { url, wasmBaseName, tgz_url } = trame.state.get(
      `__trame_vtklocal_${bits}`,
    );

    let removeProgressCallback: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const resize = debounce(async () => {
      if (!hasRemoteSession()) return;
      const { width, height } = (
        container.current as HTMLDivElement
      ).getBoundingClientRect();
      const w = Math.floor(width * window.devicePixelRatio + 0.5);
      const h = Math.floor(height * window.devicePixelRatio + 0.5);
      await context.remoteSession.setSizeAsync(renderWindow, w, h);
    }, 100);
    context.resize = resize;

    function checkMemory() {
      if (!hasRemoteSession()) return;
      context.remoteSession.freeMemory(propsRef.current.cacheSize ?? cacheSize);
      if (!propsRef.current.emitMemory) return;
      emit(
        "memory-vtk",
        Number(
          context.remoteSession.native.getTotalVTKDataObjectMemoryUsage(),
        ),
      );
      emit(
        "memory-arrays",
        Number(context.remoteSession.native.getTotalBlobMemoryUsage()),
      );
    }

    context.update = async (options?: unknown) => {
      if (!hasRemoteSession()) return;
      const t0 = Date.now();
      await context.remoteSession.updateAsync(renderWindow);
      const t1 = Date.now();
      console.log("Updated in", t1 - t0);
      emit("updated", options);
      checkMemory();
    };

    context.applyListeners = () => {
      if (!hasRemoteSession()) return;
      while (context.listenersTags.length) {
        const [cid, tag] = context.listenersTags.pop();
        context.remoteSession.native.unObserve(cid, tag);
      }
      const allListeners = propsRef.current.listeners || {};
      for (const [cid, eventMap] of Object.entries(allListeners)) {
        const wasmId = Number(cid);
        for (const [eventName, extractInfo] of Object.entries(
          eventMap || {},
        )) {
          const fn = createExtractCallback(
            trame,
            context.remoteSession,
            extractInfo,
          );
          context.listenersTags.push([
            wasmId,
            context.remoteSession.native.observe(wasmId, eventName, fn),
          ]);
          // Push update at registration
          fn();
        }
      }
    };

    context.applyVerbosity = () => {
      const settings = propsRef.current.verbosity;
      if (!settings || !hasRemoteSession()) return;
      const native = context.remoteSession.native;
      if (settings.objectManager && native.setObjectManagerLogVerbosity) {
        native.setObjectManagerLogVerbosity(settings.objectManager);
      }
      if (settings.invoker && native.setInvokerLogVerbosity) {
        native.setInvokerLogVerbosity(settings.invoker);
      }
      if (settings.deserializer && native.setDeserializerLogVerbosity) {
        native.setDeserializerLogVerbosity(settings.deserializer);
      }
      if (settings.serializer && native.setSerializerLogVerbosity) {
        native.setSerializerLogVerbosity(settings.serializer);
      }
    };

    (async () => {
      const wasmFuture = createFuture() as unknown as {
        promise: Promise<void>;
        resolve: () => void;
        reject: (e: unknown) => void;
      };
      try {
        const runtime = await loadAsync(
          tgz_url
            ? { url: tgz_url, ...config }
            : { url, wasmBaseName, urlIsGzip: false, ...config },
        );
        WASM_RUNTIMES[runtime.id] = runtime;
        if (!WASM_REMOTE_SESSIONS[runtime.id]) {
          WASM_REMOTE_SESSIONS[runtime.id] = runtime.createRemoteSession();
        }
        context.remoteSession = WASM_REMOTE_SESSIONS[runtime.id];
        bindNetwork(client, context.remoteSession);

        removeProgressCallback = context.remoteSession.addProgressCallback(
          (payload: any) => {
            if (!payload) return;
            const progress = context.progress;
            progress.tsNow = Date.now();
            if (!progress.active && payload.active) {
              progress.tsStart = progress.tsNow;
            }
            progress.active = !!payload.active;
            progress.state.current = payload.state?.current || 0;
            progress.state.total = payload.state?.total || 0;
            progress.hash.current = payload.hash?.current || 0;
            progress.hash.total = payload.hash?.total || 0;
            setProgressTick((v) => v + 1);
            emit("progress", {
              active: progress.active,
              elapsed: progress.tsNow - progress.tsStart,
              state: { ...progress.state },
              hash: { ...progress.hash },
            });
          },
        );

        context.wasmRuntimeId = runtime.id;
        wasmFuture.resolve();
      } catch (error) {
        wasmFuture.reject(error);
      }

      await wasmFuture.promise;
      if (context.disposed) return;
      setWasmLoading(false);

      if (!hasRemoteSession()) {
        throw new Error(
          "LocalView is mounting but the remote session is not valid.",
        );
      }

      // Bind canvas to renderWindow
      context.remoteSession.bindCanvas(
        renderWindow,
        canvas.current as HTMLCanvasElement,
      );

      if (autoResize) {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container.current as HTMLDivElement);
      }
      await context.update({ onMounted: renderWindow });
      if (context.disposed) return;

      // Camera listener
      context.remoteSession.cameraIds.forEach((cid: number) => {
        try {
          context.cameraTags.push([
            cid,
            context.remoteSession.native.observe(cid, "ModifiedEvent", () => {
              emit("camera", context.remoteSession.getState(cid));
            }),
          ]);
        } catch (err) {
          console.error("wasm64 has issue with observer", err);
        }
      });
      context.applyListeners();
      context.applyVerbosity();

      // Start event loop
      if (!context.remoteSession.startEventLoop(renderWindow)) {
        console.error("Could not startEventLoop for", renderWindow);
      }

      // trigger an emit right away
      context.remoteSession.cameraIds.forEach((cid: number) => {
        emit("camera", context.remoteSession.getState(cid));
      });

      emit("ready", context.wasmRuntimeId);
    })();

    return () => {
      emit("unmount");
      context.disposed = true;
      if (removeProgressCallback) removeProgressCallback();
      if (resizeObserver) resizeObserver.disconnect();
      if (!hasRemoteSession()) return;
      while (context.cameraTags.length) {
        const [cid, tag] = context.cameraTags.pop();
        context.remoteSession.native.unObserve(cid, tag);
      }
      while (context.listenersTags.length) {
        const [cid, tag] = context.listenersTags.pop();
        context.remoteSession.native.unObserve(cid, tag);
      }
      context.remoteSession.stopEventLoop(renderWindow);
      context.remoteSession.unbindCanvas(renderWindow);
      context.remoteSession.native.invoke(renderWindow, "Finalize", []);
      ctx.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, renderWindow]);

  // prop-driven updates
  useEffect(() => {
    ctx.current?.applyListeners?.();
  }, [listeners]);
  useEffect(() => {
    ctx.current?.applyVerbosity?.();
  }, [verbosity]);

  // Imperative surface for server js_call
  useImperativeHandle(ref, () => ({
    update: (options?: unknown) => ctx.current?.update(options),
    render: () => {
      const context = ctx.current;
      if (!context?.hasRemoteSession()) return;
      context.remoteSession.native.render(renderWindow);
    },
    resetCamera: (rendererId?: number) => {
      const context = ctx.current;
      if (!context?.hasRemoteSession()) return;
      context.remoteSession.native.resetCamera(rendererId);
      context.remoteSession.native.render(renderWindow);
    },
    invoke: async (objId: unknown, method: string, args: unknown[]) => {
      const context = ctx.current;
      if (!context?.hasRemoteSession()) return undefined;
      let reqId: unknown, wasmId: unknown;
      if (Array.isArray(objId)) {
        [reqId, wasmId] = objId;
      } else {
        wasmId = objId;
      }
      const result = await context.remoteSession.native.invoke(
        wasmId,
        method,
        args,
      );
      if (result?.Id && result?.Success) {
        result.Value = context.remoteSession.getState(result.Id);
      }
      if (reqId) {
        makeEmitter(propsRef)("invoke-response", [reqId, result]);
      }
      return result;
    },
    evalStateExtract: (definition: unknown) => {
      const context = ctx.current;
      if (!context?.hasRemoteSession()) return;
      createExtractCallback(trame, context.remoteSession, definition)();
    },
    resize: () => ctx.current?.resize(),
    printSceneManagerInformation: () => {
      const context = ctx.current;
      if (!context?.hasRemoteSession()) return;
      context.remoteSession.native.printSceneManagerInformation();
    },
    getRemoteSession: () => ctx.current?.remoteSession,
    getWasmRuntime: () => WASM_RUNTIMES[ctx.current?.wasmRuntimeId],
    getVtkObject: (vtkId: unknown) =>
      ctx.current?.remoteSession?.getVtkObject(vtkId),
    disposeRemoteSession: (runtimeId?: string) =>
      disposeRemoteSessionGlobal(runtimeId || ctx.current?.wasmRuntimeId),
    disposeWasmRuntime: (runtimeId?: string) =>
      disposeWasmRuntimeGlobal(runtimeId || ctx.current?.wasmRuntimeId),
    startWebXR: (
      mode?: unknown,
      requiredFeatures?: unknown,
      optionalFeatures?: unknown,
    ) => {
      const context = ctx.current;
      if (!context?.hasRemoteSession()) return;
      context.remoteSession.native.startWebXR(
        mode,
        requiredFeatures,
        optionalFeatures,
      );
    },
    stopWebXR: () => {
      const context = ctx.current;
      if (!context?.hasRemoteSession()) return;
      context.remoteSession.native.stopWebXR();
    },
  }));

  const progress = ctx.current?.progress;
  const showLoading =
    wasmLoading ||
    (progressEnabled &&
      progress &&
      progress.active &&
      progress.tsNow - progress.tsStart > progressDelay);

  return (
    <div
      ref={container}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <canvas
        ref={canvas}
        tabIndex={-1}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      />
      {showLoading && progressEnabled
        ? slot?.({
            progress,
            wasmLoading,
            statePercent: percent(progress?.state || {}),
            hashPercent: percent(progress?.hash || {}),
            showLoading,
          }) || <Loader wasmLoading={wasmLoading} progress={progress} />
        : null}
    </div>
  );
});

export default VtkLocal;
