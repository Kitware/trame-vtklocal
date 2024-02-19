import vtkObjectManager from "./vtkObjectManager";

export async function createModule(canvas) {
  const module = {
    canvas,
    locateFile() {
      return "__trame_vtklocal/vtkObjectManager.wasm";
    },
    print() {
      console.info(Array.prototype.slice.call(arguments).join(" "));
    },
    printErr() {
      console.error(Array.prototype.slice.call(arguments).join(" "));
    },
  };
  const objectManager = await vtkObjectManager(module);
  objectManager.initialize();
  return objectManager;
}
