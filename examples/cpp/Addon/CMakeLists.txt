cmake_minimum_required(VERSION 3.29)

project(Addon)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(GNUInstallDirs)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/${CMAKE_INSTALL_BINDIR}")
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/${CMAKE_INSTALL_LIBDIR}")
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/${CMAKE_INSTALL_LIBDIR}")

option(BUILD_SHARED_LIBS "Build shared or static libraries" ON)

if (CMAKE_SYSTEM_NAME STREQUAL "Emscripten")
  if (CMAKE_GENERATOR STREQUAL "Ninja" AND CMAKE_HOST_WIN32)
    # emcc.bat receives too many characters, so use response files instead.
    set(CMAKE_NINJA_FORCE_RESPONSE_FILE 1 CACHE INTERNAL "")
  endif ()
  # We do not need shared wasm libraries for this example.
  set(BUILD_SHARED_LIBS OFF)
  find_package(VTK REQUIRED)
else ()
  find_package(VTK REQUIRED)
endif ()

# Add modules you want to ALWAYS build here.
list(APPEND addon_requested_modules 
  Addon::Style)

# In this section, we define which modules are requested or rejected based on the platform.
# The requested modules are the ones that will be built, while the rejected modules will not be built.
if (CMAKE_SYSTEM_NAME STREQUAL "Emscripten")
  list(APPEND addon_requested_modules
    Addon::WebAssembly
    Addon::WebAssemblyAsync)
else ()
  list(APPEND addon_rejected_modules
    Addon::WebAssembly
    Addon::WebAssemblyAsync)
endif ()

# Find the vtk.module files in the Style, WebAssembly, and WebAssemblyAsync directories.
vtk_module_find_modules(module_files
  "${CMAKE_CURRENT_SOURCE_DIR}/Style"
  "${CMAKE_CURRENT_SOURCE_DIR}/WebAssembly"
  "${CMAKE_CURRENT_SOURCE_DIR}/WebAssemblyAsync")

# Add the modules found in the module files to the list
# of modules based on the requested and rejected modules.
vtk_module_scan(
  MODULE_FILES      ${module_files}
  REQUEST_MODULES   ${addon_requested_modules}
  REJECT_MODULES    ${addon_rejected_modules}
  PROVIDES_MODULES  modules
  ENABLE_TESTS      OFF)

set(addon_export "Addon")

vtk_module_build(
  MODULES ${modules}
  INSTALL_EXPORT ${addon_export}
  # Enable wrapping for the modules.
  ENABLE_WRAPPING ON
  # Enable serialization for the modules.
  ENABLE_SERIALIZATION ON)

if (NOT CMAKE_SYSTEM_NAME STREQUAL "Emscripten")
  set(addon_python_package_name "addonModules")
  vtk_module_python_default_destination(addon_python_site_packages_suffix)
  vtk_module_wrap_python(
    MODULES         ${modules}
    TARGET          Addon::Python
    WRAPPED_MODULES addon_modules
    INSTALL_EXPORT  ${addon_export}
    PYTHON_PACKAGE  ${addon_python_package_name}
    MODULE_DESTINATION  "${addon_python_site_packages_suffix}"
    CMAKE_DESTINATION   "${CMAKE_INSTALL_LIBDIR}/cmake/Addon"
    LIBRARY_DESTINATION "${CMAKE_INSTALL_LIBDIR}"
    BUILD_STATIC    OFF
    INSTALL_HEADERS OFF)

  # Create an `__init__.py` containing wrapped modules.
  foreach(module ${modules})
    _vtk_module_get_module_property("${module}"
      PROPERTY  "library_name"
      VARIABLE  library_name)
    list(APPEND python_modules "'${library_name}'")
  endforeach()

  list(JOIN python_modules ,  python_modules_string)
  configure_file(
    "${CMAKE_CURRENT_SOURCE_DIR}/__init__.py.in"
    "${CMAKE_BINARY_DIR}/${addon_python_site_packages_suffix}/${addon_python_package_name}/__init__.py"
    @ONLY)
  install(
    FILES       "${CMAKE_BINARY_DIR}/${addon_python_site_packages_suffix}/${addon_python_package_name}/__init__.py"
    DESTINATION "${addon_python_site_packages_suffix}/${addon_python_package_name}/")
endif ()
