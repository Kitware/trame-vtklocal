export default {
    base: "./",
    build: {
      lib: {
        entry: "../vue-components/src/viewer.js",
        formats: ["umd"],
        name: "vtkWASMViewer",
        fileName: "viewer",
      },
      assetsDir: ".",
      outDir: "./dist/umd",
      emptyOutDir: false,
    },
  };