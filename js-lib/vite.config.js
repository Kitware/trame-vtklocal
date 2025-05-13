export default {
    base: "./",
    build: {
      lib: {
        entry: {
          "remote": "../vue-components/src/remote.js",
          "vtk": "../vue-components/src/standalone.js",
        },
        formats: ["es"],
      },
      assetsDir: ".",
      outDir: "./dist/esm",
    },
  };