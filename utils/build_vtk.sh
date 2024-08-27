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
#       ./utils/build_vtk.sh -u https://gitlab.kitware.com/vtk/vtk.git -b master -t wasm32 -p RelWithDebInfo
#   Build python libs:
#       ./utils/build_vtk.sh -u https://gitlab.kitware.com/vtk/vtk.git -b master -t py -p RelWithDebInfo
#
# After this script is completed,
#   set VTK_WASM_DIR=dev/vtk_${branch}/build/${build_type}/wasm/bin
#   set PYTHONPATH=dev/vtk_${branch}/build/${build_type}/py/lib/pythonx.y/site-packages

set -e
set -x

usage() { echo "Usage: $0 -u <vtk-git-url> -b <branch> -t [wasm32|py] -p [Debug|Release|RelWithDebInfo|MinSizeRel] " 1>&2; exit 1; }

[ $# -eq 0 ] && usage

while getopts u:b:t:p: flag
do
    case "${flag}" in
        u) vtk_url=${OPTARG};;
        b) vtk_branch=${OPTARG};;
        t) build_target=${OPTARG};;
        p) build_type=${OPTARG};;
        *) usage;;
    esac
done

readonly vtk_url
readonly vtk_branch
readonly build_target
readonly build_type
readonly git_clone_dir="$(pwd)/dev/vtk-$vtk_branch"
readonly build_dir="build/$build_type/$build_target"

[ -d dev ] || mkdir -p dev
[ -d "$git_clone_dir" ] || git clone "$vtk_url" "$git_clone_dir"
git config --global --add safe.directory "$git_clone_dir"
[ -d "$git_clone_dir" ] && cd "$git_clone_dir" && git submodule update --init && git checkout $vtk_branch

# Ensure required tools are available.
cmake --version
ninja --version

case "$build_target" in
    wasm32)
        node --version
        emcc --version

        # build vtk.wasm binaries
        emcmake cmake \
            -S . \
            -B "$build_dir" \
            -GNinja \
            -DCMAKE_BUILD_TYPE:STRING=$build_type \
            -DBUILD_SHARED_LIBS=OFF \
            -DVTK_WRAP_SERIALIZATION=ON \
            -DVTK_BUILD_TESTING=ON \
            -DVTK_ENABLE_LOGGING=OFF \
            -DVTK_BUILD_EXAMPLES=OFF \
            -DVTK_MODULE_ENABLE_VTK_RenderingLICOpenGL2=NO

        cmake --build "$build_dir" --target WasmSceneManager
        ;;
    py)
        # build vtk python binaries
        cmake \
            -S . \
            -B "$build_dir" \
            -GNinja \
            -DCMAKE_BUILD_TYPE:STRING=$build_type \
            -DVTK_WRAP_PYTHON=ON \
            -DVTK_WRAP_SERIALIZATION=ON \
            -DVTK_BUILD_TESTING=OFF \
            -DVTK_GROUP_ENABLE_Web=YES

        cmake --build "$build_dir"
        ;;
    *)
        echo "Unknown build target $build_target. 'wasm32' and 'py' are supported"
        exit 1
esac
