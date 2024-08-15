#!/bin/bash

while getopts b:p: flag
do
    case "${flag}" in
        b) vtk_branch=${OPTARG};;
        p) build_type=${OPTARG};;
        *)
            echo "Unrecognized argument"
            exit 1
            ;;
    esac
done

readonly vtk_branch
readonly build_target
readonly build_type
readonly git_clone_dir="$(pwd)/dev/vtk-$vtk_branch"
readonly build_dir="build/$build_type"

readonly py_version=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
export PYTHONPATH="$git_clone_dir/$build_dir/py/lib/python$py_version/site-packages"
export VTK_WASM_DIR="$git_clone_dir/$build_dir/wasm32/bin"
