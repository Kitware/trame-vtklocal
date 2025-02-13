.. |pypi_download| image:: https://img.shields.io/pypi/dm/trame-vtklocal

========================================================
trame-vtklocal  |pypi_download|
========================================================

Local Rendering using VTK.wasm to match server side rendering pipeline on the client side.
The current code base is still at its infancy but we aim to make it the default implementation for local rendering using VTK/ParaView with trame.
This WASM capability is starting to be available with VTK 9.4. 

.. In term of version compatibility between VTK and trame-vtklocal we aim to follow this pattern.
.. 
.. .. list-table:: Version compatibility
..    :widths: 50 50
..    :header-rows: 1

..    * - VTK
..      - trame-vtklocal
..    * - v9.4
..      - v0
..    * - v9.5
..      - v1

License
----------------------------------------

This library is OpenSource and follow the Apache Software License

Installation
----------------------------------------

.. code-block:: console

    # to install a compatible version of VTK
    pip install "trame-vtklocal[vtk]"

    # to install VTK yourself
    pip install trame-vtklocal
    pip install "vtk>=9.4,<9.5"


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

Optionally, you can develop with bleeding edge VTK by following these steps. Make sure you've these tools

1. git
2. CMake
3. Ninja
4. Python
5. NodeJS >= 22.0.0: https://nodejs.org/en/download/package-manager
6. Emscripten SDK: See https://emscripten.org/docs/getting_started/downloads.html#download-and-install

.. code-block:: console

    # Compile VTK for wasm32 architecture using emscripten. Build artifacts can be found in dev/vtk/build/wasm
    python ./utils/build_vtk.py -u https://gitlab.kitware.com/vtk/vtk.git -b master -t wasm32 -c RelWithDebInfo

    # Compile VTK with python wrappings using system C++ compiler. Build artifacts can be found in dev/vtk/build/py
    python ./utils/build_vtk.py -u https://gitlab.kitware.com/vtk/vtk.git -b master -t py -c RelWithDebInfo

    # Windows: Set environment variables
    ./utils/dev_environment.ps1 -b master -c RelWithDebInfo
    
    # Unix: Set environemt variables
    source ./utils/dev_environment.sh -b master -c RelWithDebInfo


Running examples
----------------------------------------

.. code-block:: console

    pip install trame "trame-vtklocal[vtk]" trame-vuetify trame-vtk

    # regular trame app
    python ./examples/vtk/cone.py 


Some example are meant to test and validate WASM rendering.
Some will default for remote rendering but if you want to force them to use WASM just run `export USE_WASM=1` before executing them.

SharedArrayBuffer
----------------------------------------

To enable SharedArrayBuffer within trame you can just set the following on the server. 
This option is not required anymore but still available if needed.

.. code-block:: console

    server.http_headers.shared_array_buffer = True


This will download the threaded WASM version. Otherwise, the non-threaded version will be used as it does not require SharedArrayBuffer.


VTK.wasm vs trame-vtklocal
----------------------------------------

This repository `trame-vtklocal` focus on providing a web component that is capable of mirroring a `vtkRenderWindow` defined on the server side.
This include a JavaScript section for the browser and a Python section for the server. 

The server include a definition of a custom network protocol over our WebSocket (wslink/trame) and some helper class to ease the vtkRenderWindow binding with a web component in the browser.
While the Python package include a Vue.js component for a seamless integration with trame, we also publish a `npm package <https://www.npmjs.com/package/@kitware/trame-vtklocal>`_.
That pure JavaScript library let you still use the trame infrastructure on the server side but with your own stack on the client side. A usage example of that pure JavaScript option is covered `in that directory <https://github.com/Kitware/trame-vtklocal/tree/master/examples/pure-js>`_.

For the pure Python trame usage, you can find the `documented API <https://trame.readthedocs.io/en/latest/trame.widgets.vtklocal.html>`_.

By design there is a nice separation between VTK.wasm and trame-vtklocal which should make trame-vtklocal fairly independent of VTK.wasm version. 
But since we are still building capabilities, when the C++ API expend, we will also expand the Python/JavaScript component properties/methods. 
Hopefully we should be able to evolve trame-vtklocal with some reasonable fallback when the version of VTK is not in par with what is exposed in trame-vtklocal.

Also most the testing of VTK.wasm is in VTK repository as many validation can be done in pure C++ or `Python <https://gitlab.kitware.com/vtk/vtk/-/tree/master/Serialization/Manager/Testing/Python>`_. 
Then we have `the WASM module API <https://gitlab.kitware.com/vtk/vtk/-/blob/master/Web/WebAssembly/vtkWasmSceneManagerEmBinding.cxx>`_  with its `node/chrome testing <https://gitlab.kitware.com/vtk/vtk/-/tree/master/Web/WebAssembly/Testing/JavaScript>`_.

The documented API of `vtkWasmSceneManager <https://vtk.org/doc/nightly/html/classvtkWasmSceneManager.html>`_ and `vtkObjectManager parent of vtkWasmSceneManager <https://vtk.org/doc/nightly/html/classvtkObjectManager.html>`_

For the moment we rely on manual testing for when we change the network and/or API at the trame-vtklocal by going over a specific set of `examples <https://github.com/Kitware/trame-vtklocal/tree/master/examples>`_.

Currently the WASM implementation is used in the following set of projects:

- `Pan3D <https://github.com/Kitware/pan3d/>`_: Pan3D aims to be an utility package for viewing and processing a wide variety of multidimensional datasets. Any dataset that can be interpreted with xarray can be explored and rendered with Pan3D.


Professional Support
--------------------------------------------------------------------------

* `Training <https://www.kitware.com/courses/trame/>`_: Learn how to confidently use trame from the expert developers at Kitware.
* `Support <https://www.kitware.com/trame/support/>`_: Our experts can assist your team as you build your web application and establish in-house expertise.
* `Custom Development <https://www.kitware.com/trame/support/>`_: Leverage Kitware’s 25+ years of experience to quickly build your web application.
