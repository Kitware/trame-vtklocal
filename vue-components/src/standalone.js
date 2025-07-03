import { VtkWASMLoader, createFuture } from "./wasmLoader";

function toJsName(cxxName) {
  const jsName = `${cxxName.charAt(0).toLowerCase()}${cxxName.slice(1)}`;
  // console.log("c2j", cxxName, "=>", jsName);
  return jsName;
}

function toCxxName(jsName) {
  const cxxName = `${jsName.charAt(0).toUpperCase()}${jsName.slice(1)}`;
  // console.log("j2c", jsName, "=>", cxxName);
  return cxxName;
}

function toCxxKeys(kwArgs) {
  const wrapped = {};
  Object.entries(kwArgs).forEach(([k, v]) => {
    wrapped[toCxxName(k)] = v;
  });
  return wrapped;
}

function toJsKeys(kwArgs) {
  const wrapped = {};
  Object.entries(kwArgs).forEach(([k, v]) => {
    wrapped[toJsName(k)] = v;
  });
  return wrapped;
}

function createPropGetter(wasm, wrapMethods, vtkId) {
  if (!wasm.get) {
    return {};
  }

  const fullState = wasm.get(vtkId);
  const getPropHandler = {};
  Object.keys(fullState).forEach((propName) => {
    // console.log("Prop key:", propName);
    getPropHandler[toJsName(propName)] = () =>
      wrapMethods.decorateResult(wasm.get(vtkId)[propName]);
  });
  return getPropHandler;
}

function createPropSetter(wasm, wrapMethods, vtkId) {
  if (!wasm.get) {
    return {};
  }
  const fullState = wasm.get(vtkId);
  const setPropHandler = {};
  Object.keys(fullState).forEach((propName) => {
    setPropHandler[toJsName(propName)] = (value) =>
      wasm.set(vtkId, wrapMethods.decorateKwargs({ [propName]: value }));
  });
  return setPropHandler;
}

export function createVtkObjectProxy(
  wasm,
  vtkProxyCache,
  idToRef,
  wrapMethods,
  vtkId,
) {
  // Reuse vtkProxy if already available
  if (idToRef.has(vtkId) && idToRef.get(vtkId).deref()) {
    return idToRef.get(vtkId).deref();
  }

  // Create methods
  const observerTags = [];
  function set(props) {
    return wasm.set(vtkId, wrapMethods.decorateKwargs(toCxxKeys(props)));
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
  const propGetters = createPropGetter(wasm, wrapMethods, vtkId);
  const propSetters = createPropSetter(wasm, wrapMethods, vtkId);

  // Extract properties and unCapitalize them & add setter

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
        if (!wasm.get) {
          // To support old remote API
          wasm.updateStateFromObject(vtkId);
          return toJsKeys(wasm.getState(vtkId));
        }
        return toJsKeys(wasm.get(vtkId));
      }
      if (prop === "delete") {
        const result = wasm.destroy(vtkId);
        if (result) {
          const removedProxy = idToRef.delete(vtkId);
          vtkProxyCache.delete(removedProxy);
        }
        return result;
      }
      if (propGetters[prop]) {
        return propGetters[prop]();
      }
      if (!target[prop]) {
        // console.log("register method", prop, toCxxName(prop));
        target[prop] = async (...args) =>
          wrapMethods.decorateResult(
            await wasm.invoke(vtkId, toCxxName(prop), wrapMethods.decorateArgs(args)),
          );
      }
      return target[prop];
    },
    set(target, property, value) {
      if (propSetters[property]) {
        propSetters[property](value);
      }
      return value;
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
    return args.map((v) => (vtkProxyCache.has(v) ? v.obj : v));
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
        result.Id,
      );
    }
    return result;
  }
  internalMethods.decorateResult = decorateResult;

  function getVtkObject(obj_or_id) {
    return createVtkObjectProxy(
      wasm,
      vtkProxyCache,
      idToRef,
      internalMethods,
      obj_or_id.Id || obj_or_id,
    );
  }

  function create(name, args) {
    const vtkId = wasm.create(name);
    if (args) {
      wasm.set(vtkId, decorateKwargs(toCxxKeys(args)));
    }
    return createVtkObjectProxy(
      wasm,
      vtkProxyCache,
      idToRef,
      internalMethods,
      vtkId,
    );
  }

  return new Proxy(
    { getVtkObject },
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
    },
  );
}

/**
 * Create a VTK namespace for handling vtk object creation.
 *
 * @param {String} url - Optional directory to where VTK.wasm is getting served from.
 *                  If vtkWebAssemblyInterface.mjs is already loaded as a script,
 *                  this will be ignored.
 * @param {Object} config
 *
 * @returns the vtk namespace for creating VTK objects.
 */
export async function createNamespace(url, config = {}, wasmBaseName = "vtk") {
  const vtkProxyCache = new WeakMap();
  const idToRef = new Map();

  const loader = new VtkWASMLoader();
  await loader.load(url || "loaded-module", config, wasmBaseName);
  const wasm = loader.createStandaloneSession();

  return createInstanciatorProxy(wasm, vtkProxyCache, idToRef);
}

/**
 * If the script is tagged with id="vtk-wasm", a global "vtk" namespace
 * will be created automatically. Since the namespace creation is asynchronous,
 * a global "vtkReady" promise will be provided to enable code synchronization.
 *
 * Possible data attributes:
 *  - data-url="url to load VTK.wasm from" only needed if VTK.wasm is not already loaded.
 *  - data-config="{ rendering: 'webgl|webgpu', exec: 'sync|async' }" json config for
 *    WASM module configuration.
 */
const { promise, resolve, reject } = createFuture();
const script = document.querySelector("#vtk-wasm");
if (script) {
  const url = script.dataset.url || ".";
  const config = JSON.parse(script.dataset.config || "{}");
  window.vtkReady = promise;
  createNamespace(url, config).then((vtk) => {
    window.vtk = vtk;
    resolve(vtk);
  });
} else {
  reject('No script with id="vtk-wasm"');
}
