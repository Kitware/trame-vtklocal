#!/bin/bash

while getopts b:c: flag
do
    case "${flag}" in
        b) branch=${OPTARG};;
        c) cmake_config=${OPTARG};;
        *)
            echo "Unrecognized argument"
            exit 1
            ;;
    esac
done

readonly branch
readonly build_target
readonly cmake_config
readonly git_clone_dir="$(pwd)/dev/vtk-$branch"
readonly build_dir="build/$cmake_config"

readonly py_version=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
export PYTHONPATH="$git_clone_dir/$build_dir/py/lib/python$py_version/site-packages"
export VTK_WASM_DIR_OVERRIDE="$git_clone_dir/$build_dir/wasm32/bin"
