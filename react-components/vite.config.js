import react from "@vitejs/plugin-react";

export default {
  base: "./",
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    lib: {
      entry: "./src/main.ts",
      name: "trame_vtklocal_react",
      formats: ["umd"],
      fileName: "trame_vtklocal_react",
    },
    // js/ also holds the vue bundle
    emptyOutDir: false,
    rollupOptions: {
      external: ["react", "react-dom"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
    outDir: "../src/trame_vtklocal/module/serve/js",
    assetsDir: ".",
  },
};
