import { VtkWASMLoader, createFuture } from "./wasmLoader";

const TYPED_ARRAYS = {
  "Int8Array": 1,
  "Uint8Array": 1,
  "Uint8ClampedArray": 1,
  "Int16Array": 1,
  "Uint16Array": 1,
  "Int32Array": 1,
  "Uint32Array": 1,
  "Float16Array": 1,
  "Float32Array": 1,
  "Float64Array": 1,
  "BigInt64Array": 1,
  "BigUint64Array": 1,
}

function isTypedArray(obj) {
  return !!TYPED_ARRAYS[obj.constructor.name];
}

function createVtkObjectProxy(
  wasm,
  vtkProxyCache,
  idToRef,
  wrapMethods,
  vtkId
) {
  // Reuse vtkProxy if already available
  if (idToRef.has(vtkId) && idToRef.get(vtkId).deref()) {
    console.log(" => reused", vtkId);
    return idToRef.get(vtkId).deref();
  }

  // Create methods
  const observerTags = [];
  function set(props) {
    return wasm.set(vtkId, wrapMethods.decorateKwargs(props));
  }
  function observe(event, callback) {
    const tag = wasm.observe(vtkId, event, callback);
    observerTags.push(tag);
    return tag;
  }
  function unObserve(tag) {
    const tagIdx = observerTags.indexOf(tag);
    if (tagIdx !== -1) {
      observerTags.splice(tagIdx, 1);
    }
    return wasm.unObserve(vtkId, tag);
  }
  function unObserveAll() {
    while (observerTags.length) {
      unObserve(observerTags.pop());
    }
  }

  // Create proxy for given vtk object
  const target = {
    id: vtkId,
    obj: { Id: vtkId },
    set,
    observe,
    unObserve,
    unObserveAll,
  };
  const vtkProxy = new Proxy(target, {
    get(target, prop, resolver) {
      if (prop === "then") {
        return resolver;
      }
      if (prop === "state") {
        return wasm.get(vtkId);
      }
      if (!target[prop]) {
        // console.log("register method", prop);
        target[prop] = async (...args) =>
          wrapMethods.decorateResult(
            await wasm.invoke(vtkId, prop, wrapMethods.decorateArgs(args))
          );
      }
      return target[prop];
    },
  });

  // Update maps
  idToRef.set(vtkId, new WeakRef(vtkProxy));
  vtkProxyCache.set(vtkProxy, true);

  return vtkProxy;
}

function createInstanciatorProxy(wasm, vtkProxyCache, idToRef) {
  function isVtkObject(obj) {
    return vtkProxyCache.has(obj);
  }

  function decorateKwargs(kwargs) {
    const wrapped = {};
    Object.entries(kwargs).forEach(([k, v]) => {
      if (vtkProxyCache.has(v)) {
        wrapped[k] = v.obj;
      } else {
        wrapped[k] = v;
      }
    });
    return wrapped;
  }

  function decorateArgs(args) {
    const newArgs = args.map((v) => (vtkProxyCache.has(v) ? v.obj : v));
    // console.log("newArgs", newArgs);

    // Handle typed array
    if (newArgs.length === 1 && isTypedArray(newArgs[0])) {
      return newArgs[0];
    }
    return newArgs;
  }

  const internalMethods = { isVtkObject, decorateKwargs, decorateArgs };

  function decorateResult(result) {
    if (result == null) {
      return result;
    }
    if (result?.Id) {
      return createVtkObjectProxy(
        wasm,
        vtkProxyCache,
        idToRef,
        internalMethods,
        result.Id
      );
    }
    return result;
  }
  internalMethods.decorateResult = decorateResult;

  function toObject(obj_or_id) {
    return createVtkObjectProxy(
      wasm,
      vtkProxyCache,
      idToRef,
      internalMethods,
      obj_or_id.Id || obj_or_id
    );
  }

  function create(name, args) {
    const vtkId = wasm.create(name);
    if (args) {
      wasm.set(vtkId, decorateKwargs(args));
    }
    return createVtkObjectProxy(
      wasm,
      vtkProxyCache,
      idToRef,
      internalMethods,
      vtkId
    );
  }

  return new Proxy(
    { toObject },
    {
      get(target, prop, resolver) {
        if (prop === "then") {
          return resolver;
        }
        if (!target[prop]) {
          // console.log("register create method for", prop);
          target[prop] = (args) => create(prop, args);
        }
        return target[prop];
      },
    }
  );
}

export async function createNamespace(url, config={}) {
  const loader = new VtkWASMLoader();
  await loader.load(url, config);

  const wasm = loader.createStandaloneSession();
  const vtkProxyCache = new WeakMap();
  const idToRef = new Map();

  return createInstanciatorProxy(wasm, vtkProxyCache, idToRef);
}

// Auto create namespace
const { promise, resolve, reject } = createFuture();
const script = document.querySelector("#vtk-wasm");
if (script) {
  const url = script.dataset.url || ".";
  const config = JSON.parse(script.dataset.config || "{}");
  window.vtkReady = promise;
  createNamespace(url, config).then((vtk) => {
    window.vtk = vtk;
    resolve();
  });
} else {
  reject('No script with id="vtk-wasm"');
}