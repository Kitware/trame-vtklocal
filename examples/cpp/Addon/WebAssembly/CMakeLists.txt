if (NOT CMAKE_SYSTEM_NAME STREQUAL "Emscripten")
  message(FATAL_ERROR
    "The Addon::WebAssembly module requires Emscripten compiler.")
endif ()

vtk_module_add_serdes_wasm_package(
  MODULE Addon::WebAssembly
  OUTPUT_NAME addonWebAssembly
)
