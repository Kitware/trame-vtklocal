export async function createModule(canvas, wasmFile) {
  const module = {
    canvas,
    locateFile() {
      return `__trame_vtklocal_wasm/${wasmFile}`;
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
