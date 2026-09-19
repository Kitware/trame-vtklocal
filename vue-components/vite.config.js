import { viteStaticCopy } from 'vite-plugin-static-copy'

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
  plugins: [
      viteStaticCopy({
        targets: [
          {
            src: './node_modules/@kitware/vtk-wasm/dist/umd/viewer.css',
            dest: "../viewer",
            rename: { stripBase: 5 },
          },
          {
            src: './node_modules/@kitware/vtk-wasm/dist/umd/viewer.umd.js',
            dest: "../viewer",
            rename: { stripBase: 5 },
          },
        ]
      })
  ],
};
