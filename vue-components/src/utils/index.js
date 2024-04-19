export async function createModule(canvas, wasmURL) {
  const module = {
    canvas,
    locateFile() {
      return wasmURL;
    },
    print() {
      console.info(Array.prototype.slice.call(arguments).join(" "));
    },
    printErr() {
      console.error(Array.prototype.slice.call(arguments).join(" "));
    },
  };
  const objectManager = await window.createVTKWasmSceneManager(module);
  objectManager.initialize();
  return objectManager;
}
