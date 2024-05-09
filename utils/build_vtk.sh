#!/bin/bash
#
# This script is useful to test bleeding edge or forks of VTK with trame/vtk-local.
# By default, the project
# 1. installs the VTK wheels from pypi.org (examples/vtk/requirements.txt)
# 2. downloads the wasm binary gitlab package registry,
# both of which will not have your changes unless your topic is already merged
# in VTK upstream and a release has been cut.
#
# Tip:
#   You might want to point the `vtk_url` to your fork and checkout your branch instead of `master`.
#
# Usage:
#   Build wasm binaries:
#       docker run --rm -it -v$PWD:/work kitware/vtk:ci-fedora39-20240413 /bin/bash -c "cd /work && ./utils/build_vtk.sh wasm32"
#   Build python libs:
#       ./utils/build_vtk.sh py
#
# After this script is completed,
#   set VTK_WASM_DIR=dev/vtk/build/wasm/bin
#   set PYTHONPATH=dev/vtk/build/py/lib/pythonx.y/site-packages

set -e
set -x

readonly vtk_url="https://gitlab.kitware.com/vtk/vtk.git"
readonly vtk_branch="master"
readonly wasm32_build_config="RelWithDebInfo"
readonly py_build_config="RelWithDebInfo"

[ -d dev ] || mkdir -p dev
[ -d dev/vtk ] || git clone "$vtk_url" dev/vtk
[ -d dev/vtk ] && cd dev/vtk && git submodule update --init && git checkout $vtk_branch

# run the ci scripts to initialize VTK build tools
if ! [ -f .gitlab/cmake/bin/cmake ]; then
    if [ -d .gitlab/cmake ]; then
        rm -rf .gitlab/cmake
    fi
    .gitlab/ci/cmake.sh latest
fi

export PATH=$PWD/.gitlab:$PWD/.gitlab/cmake/bin:$PATH
cmake --version

[ -f .gitlab/ninja ] || .gitlab/ci/ninja.sh
ninja --version

[ -f .gitlab/sccache ] || .gitlab/ci/sccache.sh
sccache --start-server || echo "Server already started"

readonly build_target="${1:-py}"
case "$build_target" in
    wasm32)
        if ! [ -f .gitlab/node/bin/node ]; then
            if [ -d .gitlab/node ]; then
                rm -rf .gitlab/node
            fi
            .gitlab/ci/node.sh
        fi
        export PATH=$PWD/.gitlab/node/bin:$PATH
        export NODE_DIR=$PWD/.gitlab/node
        node --version

        if ! [ -d .gitlab/emsdk ]; then
            dnf install -y --setopt=install_weak_deps=False xz
            .gitlab/ci/emsdk.sh
            .gitlab/emsdk/emsdk install latest
        fi
        export PATH=$PWD/.gitlab/emsdk/upstream/bin:$PWD/.gitlab/emsdk/upstream/emscripten:$PATH
        clang --version
        wasm-as --version
        wasm-ld --version
        wasm-opt --version
        emcc --version

        # build vtk.wasm binaries
        [ -d build/wasm ] || mkdir -p build/wasm
        cmake \
            -S . \
            -B build/wasm \
            -GNinja \
            -DCMAKE_TOOLCHAIN_FILE="$PWD/.gitlab/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake" \
            -DCMAKE_C_COMPILER_LAUNCHER=sccache \
            -DCMAKE_CXX_COMPILER_LAUNCHER=sccache \
            -DCMAKE_BUILD_TYPE:STRING=$wasm32_build_config \
            -DBUILD_SHARED_LIBS=OFF \
            -DVTK_WRAP_SERIALIZATION=ON \
            -DVTK_BUILD_TESTING=ON \
            -DVTK_ENABLE_LOGGING=OFF \
            -DVTK_BUILD_EXAMPLES=OFF \
            -DVTK_MODULE_ENABLE_VTK_RenderingLICOpenGL2=NO

        cmake --build build/wasm --target WasmSceneManager
        ;;
    py)
        # build vtk python binaries
        [ -d build/py ] || mkdir -p build/py
        cmake \
            -S . \
            -B build/py \
            -GNinja \
            -DCMAKE_C_COMPILER_LAUNCHER=sccache \
            -DCMAKE_CXX_COMPILER_LAUNCHER=sccache \
            -DCMAKE_BUILD_TYPE:STRING=$py_build_config \
            -DVTK_WRAP_PYTHON=ON \
            -DVTK_WRAP_SERIALIZATION=ON \
            -DVTK_BUILD_TESTING=ON \
            -DVTK_GROUP_ENABLE_Web=YES

        cmake --build build/py
        ;;
    *)
        echo "Unknown build target $build_target. 'wasm32' and 'py' are supported"
        exit 1
esac
