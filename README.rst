==============
trame-vtklocal
==============

VTK Local Rendering using VTK/WASM to match server side rendering pipeline on the client side.
The current code base is still at its infancy but we aim to make it the default implementation for local rendering using VTK/ParaView with trame.

License
----------------------------------------

This library is OpenSource and follow the Apache Software License

Installation
----------------------------------------

.. code-block:: console

    pip install trame-vtklocal 

    # We need a VTK that has its wasm counterpart
    # This is the first version available with it
    # For ParaView (not yet supported), VTK don't need to be installed
    pip install "vtk==9.3.20240525.dev0" --extra-index-url https://wheels.vtk.org


Development
----------------------------------------

Build and install the Vue components

.. code-block:: console

    cd vue-components
    npm i
    npm run build
    cd -

Install the library

.. code-block:: console

    pip install -e .

Optionally, you can develop with bleeding edge VTK by following these steps

.. code-block:: console

    # Compile VTK for wasm32 architecture using emscripten. Build artifacts can be found in dev/vtk/build/wasm
    docker run --rm -it -u$(id -u):$(id -g) -v$PWD:/work dockcross/web-wasm:20230831-0ac0f7a ./utils/build_vtk.sh wasm32

    # Compile VTK with python wrappings using system C++ compiler. Build artifacts can be found in dev/vtk/build/py
    ./utils/build_vtk.sh py

    # Set environment variables
    source ./utils/dev_environment.sh

Running examples
----------------------------------------

.. code-block:: console

    pip install trame trame-vtklocal trame-vuetify trame-vtk

    # We need a VTK that has its wasm counterpart
    # This is the first version available with it
    # For ParaView (not yet supported), VTK don't need to be installed
    pip install "vtk==9.3.20240418.dev0" --extra-index-url https://wheels.vtk.org

    # regular trame app
    python ./examples/vtk/cone.py 


Some example are meant to test and validate WASM rendering.
Some will default for remote rendering but if you want to force them to use WASM just run `export USE_WASM=1` before executing them.
