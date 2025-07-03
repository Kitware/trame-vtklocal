# Addon (De)serialization example

## Build C++ project with python wrappings

```sh
cmake -S ./Addon -B ./build/Release/py -DVTK_DIR="/path/to/VTK/install/lib/cmake/vtk-x.y" -GNinja -DCMAKE_BUILD_TYPE=Release
cmake --build ./build/Release/py
cmake --install ./build/Release/py --prefix ./install/Release/py
```

## Build C++ project with emscripten

```sh
emcmake cmake -S ./Addon -B ./build/Release/wasm32 -DVTK_DIR="/path/to/VTK/install/lib/cmake/vtk-x.y" -GNinja -DCMAKE_BUILD_TYPE=Release
cmake --build ./build/Release/wasm32
cmake --install ./build/Release/wasm32 --prefix ./install/Release/wasm32
```

## Update python path with addon site-packages directory

In addition to the addon site-packages dir, also specify the VTK site-packages dir since we link to a VTK installation
rather than using VTK from pypi.

```sh
export PYTHONPATH="$PWD/install/Release/py/lib/python3.13/site-packages:/path/to/VTK/install/lib/python3.13/site-packages"
```

## Start Trame app

```sh
python ./highlight_picked_actor.py --server
```
