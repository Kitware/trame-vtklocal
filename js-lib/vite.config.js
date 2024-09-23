export default {
    base: "./",
    build: {
      lib: {
        entry: "../vue-components/src/core.js",
        name: "trame_vtklocal",
        formats: ["es", "umd"],
        fileName: "trame-vtklocal",
      },
      assetsDir: ".",
    },
  };