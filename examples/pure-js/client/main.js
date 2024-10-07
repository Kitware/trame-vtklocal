import "./style.css";
import Trame from "@kitware/trame";
// import { VtkWASMHandler } from "@kitware/trame-vtklocal";

async function connect() {
  const trame = new Trame()
  await trame.connect({ application: 'trame' });

  // Bind resolution
  trame.state.watch(["resolution"], (r) => {
    document.querySelector(".resolution").value = r;
  })
  document.querySelector(".resolution").addEventListener("input", (e) => {
    trame.state.set("resolution", Number(e.target.value));
  });

  // Bind ResetCamera
  document.querySelector(".resetCamera").addEventListener("click", () => {
    trame.trigger("reset_camera");
  });

  // Bind Reset Resolution
  document.querySelector(".resetResolution").addEventListener("click", () => {
    trame.trigger("reset_resolution");
  });
}

connect();