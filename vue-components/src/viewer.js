import JSZip from "jszip";
import { RemoteSession } from "./remote";
import { createFuture } from "./wasmLoader";

export class ExportViewer {
  constructor(containerSelector, remoting) {   
    this.remoting = remoting;
    this.rootContainer = document.querySelector(containerSelector);
    this.rootContainer.innerHTML = '<div class="wasm-viewer" />';
    this.container = this.rootContainer.querySelector(".wasm-viewer");
  }

  async load(url) {
    // Fetch file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    const fileContent = await response.blob();

    // Process zip
    let progress = 0;
    const { promise, resolve } = createFuture();
    const zipFile = new JSZip();
    const zipContent = await zipFile.loadAsync(fileContent);
    const config = JSON.parse(
      await zipContent.file("vtk-wasm.json").async("string")
    );
    const rwId = config.ids[0];
    progress++;
    zipContent.folder("states").forEach(async (relativePath, file) => {
      progress++;
      const state = JSON.parse(await file.async("string"));
      this.remoting.sceneManager.registerState(state);
      progress--;
      if (progress === 0) {
        resolve();
      }
    });
    zipContent.folder("blobs").forEach(async (relativePath, file) => {
      progress++;
      const blob = await file.async("uint8array");
      this.remoting.sceneManager.registerBlob(relativePath, blob);
      progress--;
      if (progress === 0) {
        resolve();
      }
    });
    progress--;

    await promise;
    this.remoting.sceneManager.updateObjectsFromStates();

    // Bind canvas
    const selector = this.remoting.bindCanvasToDOM(rwId, this.container);
    this.container
      .querySelector(selector)
      .setAttribute(
        "style",
        "position: absolute; left: 0; top: 0; width: 100%; height: 100%;"
      );

    this.remoting.sceneManager.bindRenderWindow(rwId, selector);
    this.remoting.sceneManager.startEventLoop(rwId);
  }
}

export async function createViewer(containerSelector, dataURL, wasmURL, wasmConfig) {
  const remoting = new RemoteSession();
  await remoting.load(wasmURL || "loaded-module", wasmConfig);
  const viewer = new ExportViewer(containerSelector, remoting);
  await viewer.load(dataURL);
}


    