.. |pypi_download| image:: https://img.shields.io/pypi/dm/trame-vtklocal

========================================================
trame-vtklocal  |pypi_download|
========================================================

Local Rendering using VTK.wasm to match server side rendering pipeline on the client side.
The current code base is still at its infancy but we aim to make it the default implementation for local rendering using VTK/ParaView with trame.
This WASM capability is starting to be available with VTK 9.4 but major improvement are happening in VTK 9.6.

Additional documentation can be found on `vtk-wasm documentation <https://kitware.github.io/vtk-wasm/>`_.

VTK `9.4`, `9.5` and `9.6` are compatible with `trame-vtklocal>=0.16,<1` while `trame-vtklocal>=1` will only be compatible with `VTK 10`.
What we envision with VTK 10 is the completion of the main work with WASM and WebGPU. We will take that opportunity to cleanup
the code in trame-vtklocal by removing legacy setup that were needed for VTK 9.4 and 9.5.

A simple demo can be executed like so

.. code-block:: console

    # Using the local repository file
    uv run ./examples/demo/widget.py

    # Or from the url
    uv run https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/demo/widget.py

To get the following

.. image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/trame-vtklocal.png
  :alt: Usage example of trame-vtklocal

License
----------------------------------------

This library is OpenSource and follow the Apache Software License

Installation
----------------------------------------

.. code-block:: console

    # to install VTK yourself
    pip install trame-vtklocal

    # for the latest VTK capabilities
    pip install "vtk>=9.6" --pre --index-url https://wheels.vtk.org


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

    # Create venv and install all dependencies
    uv sync --all-extras --dev

    # Activate environment
    source .venv/bin/activate

    # Install commit analysis
    pre-commit install
    pre-commit install --hook-type commit-msg

Optionally, you can develop with bleeding edge VTK by following these steps. Make sure you've these tools

1. git
2. CMake
3. Ninja
4. Python
5. NodeJS >= 24.0.1: https://nodejs.org/en/download/package-manager
6. Emscripten SDK version 4.0.20: See https://emscripten.org/docs/getting_started/downloads.html#download-and-install

.. code-block:: console

    # Compile VTK for wasm32 architecture using emscripten. Build artifacts can be found in dev/vtk/build/wasm
    python ./utils/build_vtk.py -u https://gitlab.kitware.com/vtk/vtk.git -b master -t wasm32 -c RelWithDebInfo

    # Compile VTK with python wrappings using system C++ compiler. Build artifacts can be found in dev/vtk/build/py
    python ./utils/build_vtk.py -u https://gitlab.kitware.com/vtk/vtk.git -b master -t py -c RelWithDebInfo

    # Windows: Set environment variables
    ./utils/dev_environment.ps1 -b master -c RelWithDebInfo

    # Unix: Set environment variables
    source ./utils/dev_environment.sh -b master -c RelWithDebInfo


Running examples
----------------------------------------

.. code-block:: console

    uv sync --all-extras --dev

    # Activate environment
    source .venv/bin/activate

    pip install -r ./examples/requirements.txt

    # regular trame app
    python ./examples/vtk/cone.py


Some example are meant to test and validate WASM rendering.
Some will default for remote rendering but if you want to force them to use WASM just run `export USE_WASM=1` before executing them.

Example gallery
----------------------------------------

The examples below live in `examples/vtk <https://github.com/Kitware/trame-vtklocal/tree/master/examples/vtk>`_.
Click a screenshot to open its source.

.. |cone| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/cone.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/cone.py
   :alt: cone.py
   :width: 100%

.. |axes_actor| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/axes_actor.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/axes_actor.py
   :alt: axes_actor.py
   :width: 100%

.. |glyph| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/glyph.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/glyph.py
   :alt: glyph.py
   :width: 100%

.. |lut| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/lut.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/lut.py
   :alt: lut.py
   :width: 100%

.. |silhouette| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/silhouette.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/silhouette.py
   :alt: silhouette.py
   :width: 100%

.. |volume| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/volume.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/volume.py
   :alt: volume.py
   :width: 100%

.. |flow| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/flow.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/flow.py
   :alt: flow.py
   :width: 100%

.. |file_viewer| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/file_viewer.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/file_viewer.py
   :alt: file_viewer.py
   :width: 100%

.. |invoke| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/invoke.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/invoke.py
   :alt: invoke.py
   :width: 100%

.. |actor_picker| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/actor_picker.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/actor_picker.py
   :alt: actor_picker.py
   :width: 100%

.. |actor_highlight_on_hover| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/actor_highlight_on_hover.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/actor_highlight_on_hover.py
   :alt: actor_highlight_on_hover.py
   :width: 100%

.. |many_actors| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/many_actors.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/many_actors.py
   :alt: many_actors.py
   :width: 100%

.. |render_benchmark| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/render_benchmark.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/render_benchmark.py
   :alt: render_benchmark.py
   :width: 100%

.. |wasm64_large_mesh| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/wasm64_large_mesh.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/wasm64_large_mesh.py
   :alt: wasm64_large_mesh.py
   :width: 100%

.. |border_widget| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/border_widget.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/border_widget.py
   :alt: border_widget.py
   :width: 100%

.. |widgets_box| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/widgets_box.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/widgets_box.py
   :alt: widgets_box.py
   :width: 100%

.. |widgets_camera| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/widgets_camera.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/widgets_camera.py
   :alt: widgets_camera.py
   :width: 100%

.. |widgets_plane_clip| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/widgets_plane_clip.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/widgets_plane_clip.py
   :alt: widgets_plane_clip.py
   :width: 100%

.. |widgets_plane_slice| image:: https://raw.githubusercontent.com/Kitware/trame-vtklocal/refs/heads/master/examples/vtk/screenshots/widgets_plane_slice.png
   :target: https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/widgets_plane_slice.py
   :alt: widgets_plane_slice.py
   :width: 100%

.. list-table::
   :widths: 33 33 33

   * - |cone|

       `cone.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/cone.py>`_

       Minimal cone with resolution slider.

     - |axes_actor|

       `axes_actor.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/axes_actor.py>`_

       Orientation axes rendered next to a cone.

     - |glyph|

       `glyph.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/glyph.py>`_

       ``vtkGlyph3D`` with switchable glyph sources.

   * - |lut|

       `lut.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/lut.py>`_

       Lookup table and color map editing.

     - |silhouette|

       `silhouette.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/silhouette.py>`_

       ``vtkPolyDataSilhouette`` outlines.

     - |volume|

       `volume.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/volume.py>`_

       Volume rendering with selectable mapper.

   * - |flow|

       `flow.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/flow.py>`_

       Contours and streamlines of a flow dataset.

     - |file_viewer|

       `file_viewer.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/file_viewer.py>`_

       Load and display VTP / VTM files.

     - |invoke|

       `invoke.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/invoke.py>`_

       Call VTK methods on the client-side objects.

   * - |actor_picker|

       `actor_picker.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/actor_picker.py>`_

       Pick actors from the browser.

     - |actor_highlight_on_hover|

       `actor_highlight_on_hover.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/actor_highlight_on_hover.py>`_

       Highlight the actor under the cursor.

     - |many_actors|

       `many_actors.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/many_actors.py>`_

       Stress test with many independent actors.

   * - |render_benchmark|

       `render_benchmark.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/render_benchmark.py>`_

       Many-actor render benchmark on a process plant scene.

     - |wasm64_large_mesh|

       `wasm64_large_mesh.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/wasm64_large_mesh.py>`_

       Mesh above 4 GiB requiring the wasm64 runtime.

     - |border_widget|

       `border_widget.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/border_widget.py>`_

       ``vtkBorderWidget`` over a sphere.

   * - |widgets_box|

       `widgets_box.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/widgets_box.py>`_

       ``vtkBoxWidget2`` transforming an actor.

     - |widgets_camera|

       `widgets_camera.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/widgets_camera.py>`_

       ``vtkCameraOrientationWidget``.

     - |widgets_plane_clip|

       `widgets_plane_clip.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/widgets_plane_clip.py>`_

       Interactive plane clipping.

   * - |widgets_plane_slice|

       `widgets_plane_slice.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/widgets_plane_slice.py>`_

       Interactive plane slicing (uses wasm64 for 64-bit ids).

     -

     -

Two examples are kept as known limitations and have no screenshot:

- `balloon_widget.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/balloon_widget.py>`_: ``vtkBalloonWidget``
- `charts_scatter.py <https://github.com/Kitware/trame-vtklocal/blob/master/examples/vtk/charts_scatter.py>`_: ``vtkChartXY`` scatter plot


Progress events
----------------------------------------

The client-side VtkLocal component emits a `progress` event while wasm sync is happening.
This can be used to keep a global loader visible until the first sync completes.

.. code-block:: python

    from trame.widgets import vtklocal, vuetify

    state.app_loading = True
    state._vtklocal_seen_active = False

    def on_vtklocal_progress(event):
        if event.get("active"):
            state._vtklocal_seen_active = True
            state.app_loading = True
        elif state._vtklocal_seen_active:
            state.app_loading = False

    with vuetify.VOverlay(v_model=("app_loading",), absolute=True):
        vuetify.VProgressCircular(indeterminate=True, size=64)

    view = vtklocal.LocalView(
        render_window,
        progress=(on_vtklocal_progress, "[$event]"),
    )

If you are using the Vue component directly, you can override the built-in loader
with the `loader` slot.

.. code-block:: html

    <vtk-local>
      <template #loader="{ progress, wasmLoading, statePercent, hashPercent }">
        <div v-if="wasmLoading">Loading wasm...</div>
        <div v-else>
          States: {{ progress.state.current }}/{{ progress.state.total }}
          Blobs: {{ progress.hash.current }}/{{ progress.hash.total }}
        </div>
      </template>
    </vtk-local>

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
While the Python package include a Vue.js component for a seamless integration with trame, we also publish a `npm package <https://www.npmjs.com/package/@kitware/vtk-wasm>`_.
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
