export default {
  base: "./",
  build: {
    lib: {
      entry: "./src/main.js",
      name: "trame_vtklocal",
      formats: ["umd"],
      fileName: "trame_vtklocal",
    },
    rollupOptions: {
      external: ["vue"],
      output: {
        globals: {
          vue: "Vue",
        },
      },
    },
    outDir: "../src/trame_vtklocal/module/serve/js",
    assetsDir: ".",
  },
};
