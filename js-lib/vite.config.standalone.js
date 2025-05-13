export default {
    base: "./",
    build: {
      lib: {
        entry: "../vue-components/src/standalone.js",
        formats: ["umd"],
        name: "vtkWASM",
        fileName: "vtk",
      },
      assetsDir: ".",
      outDir: "./dist/umd",
    },
  };