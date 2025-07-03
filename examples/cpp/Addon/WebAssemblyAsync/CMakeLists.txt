if (NOT CMAKE_SYSTEM_NAME STREQUAL "Emscripten")
  message(FATAL_ERROR
    "The Addon::WebAssemblyAsync module requires Emscripten compiler.")
endif ()

vtk_module_add_serdes_wasm_package(
  ASYNC
  MODULE Addon::WebAssemblyAsync
  OUTPUT_NAME addonWebAssemblyAsync
)
