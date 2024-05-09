readonly py_version=$(python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
export PYTHONPATH="$PWD/dev/vtk/build/py/lib/python$py_version/site-packages"
export VTK_WASM_DIR=$PWD/dev/vtk/build/wasm/bin
