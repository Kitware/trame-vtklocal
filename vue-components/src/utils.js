class CanvasId {
  constructor() {
    this.count = 0;
  }

  nextId() {
    this.count++;
    return `vtk-wasm-${this.count}`;
  }
}

const CANVAS_ID_GENERATOR = new CanvasId();
export function createFuture() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
export function debounce(func, delay = 100) {
  let timeoutId;

  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(func, delay, ...args);
  };
}

export function bindNetwork(client, remoteSession) {
  const rpcSession = client.getConnection().getSession();

  async function netFetchState(vtkId) {
    return await rpcSession.call("vtklocal.get.state", [vtkId]);
  }

  async function netFetchBlob(hash) {
    const content = await rpcSession.call("vtklocal.get.hash", [hash]);
    // handle either blob or TypedArray
    const array = content.arrayBuffer
      ? new Uint8Array(await content.arrayBuffer())
      : content;
    return array;
  }

  async function netFetchStatus(vtkId) {
    return await rpcSession.call("vtklocal.get.status", [vtkId]);
  }

  remoteSession.bindNetwork(netFetchState, netFetchBlob, netFetchStatus);
}

export function createExtractCallback(trame, remoteSession, extractInfo) {
  return function () {
    remoteSession.clearStateCache();
    for (const [name, props] of Object.entries(extractInfo)) {
      const value = {};
      for (const [propName, statePath] of Object.entries(props)) {
        value[propName] = remoteSession.getStateValue(statePath, true);
      }
      trame.state.set(name, value);
    }
    remoteSession.clearStateCache();
  };
}

export function generateNextCanvasId() {
  return CANVAS_ID_GENERATOR.nextId();
}
