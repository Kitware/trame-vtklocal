export async function createModule(canvas) {
  const module = {
    canvas,
    locateFile() {
      return "__trame_vtklocal/wasm/vtkSceneManager-9.3.wasm";
    },
    print() {
      console.info(Array.prototype.slice.call(arguments).join(" "));
    },
    printErr() {
      console.error(Array.prototype.slice.call(arguments).join(" "));
    },
  };
  const objectManager = await window.createVTKSceneManager(module);
  objectManager.initialize();
  return objectManager;
}
