# CHANGELOG


## v0.15.4 (2025-11-29)

### Bug Fixes

- **api**: Expose resize & wasmManager
  ([`2cc72d6`](https://github.com/Kitware/trame-vtklocal/commit/2cc72d6f351e64dec51332befaafe14ab39e7667))


## v0.15.3 (2025-11-08)

### Bug Fixes

- **camera**: Trigger camera event at startup and add render() method
  ([`0dee6eb`](https://github.com/Kitware/trame-vtklocal/commit/0dee6ebfdd64e251e8ef430b8f0279b1d90c6b3a))

### Continuous Integration

- Use playwright in tests
  ([`c61c1eb`](https://github.com/Kitware/trame-vtklocal/commit/c61c1eb80b7a98d846d4f12cf69dd342bcb440d0))

Signed-off-by: Patrick Avery <patrick.avery@kitware.com>

### Documentation

- Use TrameApp class in file_viewer.py
  ([`f77ba50`](https://github.com/Kitware/trame-vtklocal/commit/f77ba50a54beead370ea5ad8cc3d4e6c5e431b26))


## v0.15.2 (2025-08-25)

### Bug Fixes

- **wasm**: Handle different WASM file naming for older versions
  ([`f6f8c93`](https://github.com/Kitware/trame-vtklocal/commit/f6f8c935eeed985c9f74ca516084611de72186dc))

### Documentation

- **BorderWidget**: Try vtkBorderWidget
  ([`3cf5a41`](https://github.com/Kitware/trame-vtklocal/commit/3cf5a41eba4e393357ed2ce79e9f819b8728bfe0))


## v0.15.1 (2025-08-14)

### Bug Fixes

- **css**: Import css from vtk-wasm
  ([`df8a55f`](https://github.com/Kitware/trame-vtklocal/commit/df8a55fba710cfd6749ca66dd551fa2b0a14a08f))


## v0.15.0 (2025-08-13)

### Chores

- Remove GitHub workflow for publishing @kitware/trame-vtklocal to npm
  ([`e866983`](https://github.com/Kitware/trame-vtklocal/commit/e8669833bf2880d6577b88c3025743a59105fe3c))

### Continuous Integration

- Update apt cache before installing osmesa
  ([`0545876`](https://github.com/Kitware/trame-vtklocal/commit/054587696082865bf577cf3ae1cb0e2978740335))

### Features

- Remove js-lib and refactor vue-components to use @kitware/vtk-wasm
  ([`06240a7`](https://github.com/Kitware/trame-vtklocal/commit/06240a716919e724e81c3cd3a0a4f4252a13bcdd))

- Deleted js-lib directory including package.json, vite configuration files, and related build
  scripts. - Updated vue-components package.json to include @kitware/vtk-wasm as a dependency. -
  Refactored VtkLocal component to import RemoteSession from @kitware/vtk-wasm. - Removed remote.js,
  standalone.js, viewer.js, wasmLoader.js, style.css from vue-components. - Updated viewer.js to
  remove ExportViewer class and related functionality.


## v0.14.1 (2025-08-05)

### Bug Fixes

- Remove trame_server from kwargs as it is already passed as a positional argument
  ([`802cee7`](https://github.com/Kitware/trame-vtklocal/commit/802cee759da7f4e4a849ad4bdd5fcf0777035af1))

### Documentation

- Add pyvista example with mapper input issue
  ([`3384bb7`](https://github.com/Kitware/trame-vtklocal/commit/3384bb798460a289a630f8c25fcde3a213bafb4c))


## v0.14.0 (2025-07-29)

### Chores

- Update build_vtk.py build command
  ([`6ffd92a`](https://github.com/Kitware/trame-vtklocal/commit/6ffd92aa349511c6c23b826b84d99a18880e0675))

- build all wasm targets - added a -j/--parallel option to specify number of build jobs. this
  argument is forwarded to cmake --build

- Update wasm file names to copy when VTK_WASM_DIR is set
  ([`29a26ea`](https://github.com/Kitware/trame-vtklocal/commit/29a26ea734cbc0727d46715cd12eb6f179175ed8))

### Documentation

- **dev**: Update node and emsdk versions
  ([`3ce2dd9`](https://github.com/Kitware/trame-vtklocal/commit/3ce2dd9031e016bb9d95399070dae4a73e6078e4))

- **example**: Add serialization clipping issue
  ([`89c51f0`](https://github.com/Kitware/trame-vtklocal/commit/89c51f0731048f7b20c20a3a798a6994496491d8))

- **examples**: Add snapshot viewer for loading exported states
  ([`363ca9f`](https://github.com/Kitware/trame-vtklocal/commit/363ca9f408cb86e137a368b3ffc95402c22d9284))

### Features

- **addon**: Support serialization of addon VTK modules
  ([`de5c018`](https://github.com/Kitware/trame-vtklocal/commit/de5c018b591a053035b81732368265fcfd932e5e))


## v0.13.2 (2025-06-26)

### Bug Fixes

- **vtk**: Update vtk version constrain to be 9.4+
  ([`3f95d62`](https://github.com/Kitware/trame-vtklocal/commit/3f95d6216d52a59f781e1420123ea3de005741c4))


## v0.13.1 (2025-06-19)

### Bug Fixes

- **js**: Proper docker mjs file detection
  ([`8ca375c`](https://github.com/Kitware/trame-vtklocal/commit/8ca375c17634b50d6939ed5109cb78f977aaecf0))


## v0.13.0 (2025-06-16)

### Documentation

- Fix pure-js example
  ([`fb3d2c1`](https://github.com/Kitware/trame-vtklocal/commit/fb3d2c1ccf0ee3737f81d36f63f7adfe8abb02f3))

- Update picking with standalone api
  ([`da29bcd`](https://github.com/Kitware/trame-vtklocal/commit/da29bcd8ee70f0089b79eb19ef2056b298696105))

### Features

- **invoke**: Enable vtk object unwrap
  ([`27460d3`](https://github.com/Kitware/trame-vtklocal/commit/27460d30717cf73a8397b33cc98559624f46e4e8))


## v0.12.3 (2025-06-02)

### Bug Fixes

- **wasm**: Use new library name
  ([`c7820d0`](https://github.com/Kitware/trame-vtklocal/commit/c7820d0e1d1c13db35d52e665044be1b72181178))

### Chores

- Wasm JS API follow JS convention
  ([`c58b3d8`](https://github.com/Kitware/trame-vtklocal/commit/c58b3d881f47965b614ea59660495edc403b493b))

### Continuous Integration

- Bump js version
  ([`5697bcd`](https://github.com/Kitware/trame-vtklocal/commit/5697bcd52d191ed46b413ef31f84dd87ed06ab10))

### Documentation

- **example**: Fix linting issue in example
  ([`77c56fe`](https://github.com/Kitware/trame-vtklocal/commit/77c56fe92b0c559262ad0b268acf01a481a9a44a))

- **example**: Fix picking dependencies
  ([`0309838`](https://github.com/Kitware/trame-vtklocal/commit/0309838dc1ad695d583b02ba706721ca8fd02720))

- **example**: Make example self executable
  ([`0dffc7a`](https://github.com/Kitware/trame-vtklocal/commit/0dffc7a2775e344a5996a0f4ed2ad5beff3c9391))

- **js**: Update pure js example
  ([`7d8ee4e`](https://github.com/Kitware/trame-vtklocal/commit/7d8ee4ef6587ccb5f6ca15f1b23a819e7696cac8))

- **lut**: Add lut example
  ([`761375a`](https://github.com/Kitware/trame-vtklocal/commit/761375afac76149f808f4b86bda32998606168fb))


## v0.12.2 (2025-05-19)

### Bug Fixes

- **viewer**: Createviewer return viewer
  ([`127df0b`](https://github.com/Kitware/trame-vtklocal/commit/127df0bdf2303b775f8b67e1311b61fddd52f68d))

- **vtklocal**: Expose getVtkObject from vue component
  ([`e17c1a1`](https://github.com/Kitware/trame-vtklocal/commit/e17c1a19dceef261d4ed673b472a14303a88f4a7))

### Chores

- **js**: Add getVtkObject(id) on vtk namespace
  ([`86a4209`](https://github.com/Kitware/trame-vtklocal/commit/86a420973287989dca3464a45ff3e8d721270698))

- **js**: Add missing delete() method on vtk proxy
  ([`1ce77cd`](https://github.com/Kitware/trame-vtklocal/commit/1ce77cdd120a2851ca70311f055fcfefc6884273))

- **js**: Bump version of the js-lib
  ([`fc7cc47`](https://github.com/Kitware/trame-vtklocal/commit/fc7cc47e5f95337901578443ae98c9cbe0764f91))

### Continuous Integration

- Fix js-lib build
  ([`9d098c8`](https://github.com/Kitware/trame-vtklocal/commit/9d098c847e539e1625db6f14b3dbdb961860f8a6))


## v0.12.1 (2025-05-15)

### Bug Fixes

- **interaction**: Await on scene manager render
  ([`b5ffc9e`](https://github.com/Kitware/trame-vtklocal/commit/b5ffc9e491161a5e6e68b761f89c63849efcf079))

- when not awaited, the `startEventLoop` got called before the interactor->Enabled was set to true,
  therefore `startEventLoop` became a no-op - also use await on methods which call
  `vtkRemoteSession::Render` since that returns a promise too.

- **viewer**: Add wasm export viewer
  ([`f84a8a0`](https://github.com/Kitware/trame-vtklocal/commit/f84a8a0e3aec4b6818b355e0be329c102749aaf2))


## v0.12.0 (2025-05-15)

### Bug Fixes

- **config**: Allow per widget config
  ([`3fcfe5b`](https://github.com/Kitware/trame-vtklocal/commit/3fcfe5bbf06cb8a82e4cd542900e230ad93af06a))

- **invoke**: Use obj decorator instead of id
  ([`5a0f560`](https://github.com/Kitware/trame-vtklocal/commit/5a0f560612ca6157bfdf81002529ca90d01a405a))

- **js**: Support legacy and new API
  ([`1f28ed1`](https://github.com/Kitware/trame-vtklocal/commit/1f28ed197cc0af48ebd5a15864e70a0f4fa9c718))

- **js-lib**: Publish new bundle
  ([`40d1f8c`](https://github.com/Kitware/trame-vtklocal/commit/40d1f8c24f105c5056815a353abb0255a7698748))

- **standalone**: Allow property handling
  ([`d2dc1ec`](https://github.com/Kitware/trame-vtklocal/commit/d2dc1ec0529ad770364c54074c617a94cf6d5de4))

- **standalone**: Remove custom typedArray handling
  ([`a2bd56f`](https://github.com/Kitware/trame-vtklocal/commit/a2bd56fdc7c2d32f8cb6c9025ef22e2bc928b62e))

### Documentation

- Use trame 3.9 notation
  ([`ae00d71`](https://github.com/Kitware/trame-vtklocal/commit/ae00d71313e57171c5490c0107a8759a0285d4bc))

- **example**: Expand vuetify widget example
  ([`ef5652b`](https://github.com/Kitware/trame-vtklocal/commit/ef5652bfd44dbe19f6224c69bd1a9ea84fe15954))

- **example**: Use uv to allow standalone exec
  ([`851574e`](https://github.com/Kitware/trame-vtklocal/commit/851574e22859c7ea9a7d83768b6cf11a73b6cf1c))

- **standalone**: Add config options
  ([`ab2bf09`](https://github.com/Kitware/trame-vtklocal/commit/ab2bf093b55af9fd73bdca25459a6c20c2175af3))

### Features

- **js**: Handle legacy and new wasm bundle
  ([`d4e88fd`](https://github.com/Kitware/trame-vtklocal/commit/d4e88fddbe34a53fceb2f1c9c9a446328be3ee62))


## v0.11.0 (2025-05-12)

### Chores

- Restructure code to use hatchling
  ([`3017940`](https://github.com/Kitware/trame-vtklocal/commit/301794055b93a95a970b2178bc648389fd65f793))

### Continuous Integration

- Bump JS library version
  ([`abd8aa0`](https://github.com/Kitware/trame-vtklocal/commit/abd8aa09749e0bfac4b40c2d557fb4bf485c49f8))

### Features

- **invoke**: Allow method call for picking
  ([`0accb79`](https://github.com/Kitware/trame-vtklocal/commit/0accb790f493fa780adfe6c1627e52b230feb0e2))


## v0.10.0 (2025-05-09)

### Features

- Add save capability and fix verbosity
  ([`b21ae94`](https://github.com/Kitware/trame-vtklocal/commit/b21ae94cd79ac51ccd3452164fd6cb688f36d0bb))


## v0.9.0 (2025-05-06)

### Bug Fixes

- Add method to free global handlers
  ([`5b492e9`](https://github.com/Kitware/trame-vtklocal/commit/5b492e98afabf83b80ce2244570fa32fc7135f8c))

- Allow vue component to share wasm runtime
  ([`7e4ac06`](https://github.com/Kitware/trame-vtklocal/commit/7e4ac06f3570fc4dda76ea7a90db5f71fd05987a))

- Remove state patching with new API
  ([`86e2c08`](https://github.com/Kitware/trame-vtklocal/commit/86e2c08d38fc29d10a92737dd8e233ab82fe324d))

### Documentation

- **example**: Remove dead code
  ([`abbcc1e`](https://github.com/Kitware/trame-vtklocal/commit/abbcc1e5a15fc59cff4c6eedc9eea98ba1afbf92))

- **example**: Test opacity change on cone
  ([`5aec836`](https://github.com/Kitware/trame-vtklocal/commit/5aec836d762e3fa98e0507050df227372dbf6dc5))

### Features

- **handler**: Allow shared handler
  ([`e64f2e6`](https://github.com/Kitware/trame-vtklocal/commit/e64f2e6c09ff4431038fc32ef8351cf12c92c0fe))

- **js-lib**: New version for state patching and concurrent loading
  ([`2fb2b21`](https://github.com/Kitware/trame-vtklocal/commit/2fb2b2194c56fae0f70515fed8e7cf6b03f7c992))


## v0.8.0 (2025-04-04)

### Features

- **method**: Enable method call from Python and JS
  ([`8f45337`](https://github.com/Kitware/trame-vtklocal/commit/8f453375be5d36416a317c059e325bf9eb9a9897))


## v0.7.1 (2025-02-13)

### Bug Fixes

- **readme**: Fix syntax for pypi
  ([`cddb3a1`](https://github.com/Kitware/trame-vtklocal/commit/cddb3a11cd4c31a23db19ddddf7e16635d3fe1b1))


## v0.7.0 (2025-02-13)

### Features

- **py-api**: Extend python api
  ([`627acfe`](https://github.com/Kitware/trame-vtklocal/commit/627acfea190e7be79aaa8b61864a85672fea289a))

fix issue 683 in trame repo Add method to update vtk class from wasm state (vtk_update_from_state)
  Rename widget method to be more generic


## v0.6.10 (2025-02-13)

### Bug Fixes

- **camera**: Clear mtime when push_camera=True
  ([`20b5069`](https://github.com/Kitware/trame-vtklocal/commit/20b50695b7c09093e8516e9841181ca7eab08985))

- **js**: Update dep version
  ([`a119073`](https://github.com/Kitware/trame-vtklocal/commit/a119073b471ece3ac76527089a17504725caf524))

### Code Style

- **ruff**: Fix ruff warming
  ([`0ecde2e`](https://github.com/Kitware/trame-vtklocal/commit/0ecde2e09ef423c9dfb54bec69a4494581a22e1b))

### Continuous Integration

- Update upload-artifact
  ([`38143c1`](https://github.com/Kitware/trame-vtklocal/commit/38143c1df50db2e315dea8a943fbc910571fc17c))

### Documentation

- Update dev tools for cross platform building
  ([`3c4d8c2`](https://github.com/Kitware/trame-vtklocal/commit/3c4d8c208f086c4870eb5663f7918011a4c78b2b))

- New cross platform `build_vtk.py` to clone and building VTK from source. - The `build_vtk.py`
  replaces `build_vtk.sh`. - New `dev_environment.ps1` to set python, wasm env vars in windows.

- Update README.rst
  ([`14b0f2f`](https://github.com/Kitware/trame-vtklocal/commit/14b0f2fab1ab36ed1fe6a592c56e79e06fb30d05))

fix rst rendering of the list items

- Update README.rst
  ([`ce94ec9`](https://github.com/Kitware/trame-vtklocal/commit/ce94ec91e59777a0a7e746a5417abfe53f8c18bd))

Rename VTK/WASM to VTK.wasm

- Update README.rst
  ([`6e5a995`](https://github.com/Kitware/trame-vtklocal/commit/6e5a995116c1d10415236500048492208d717813))

- **docker**: Add example for multi-user
  ([`74ceca3`](https://github.com/Kitware/trame-vtklocal/commit/74ceca3f4f93c3ffae68153348dc183ca8a1c1e4))


## v0.6.9 (2025-01-01)

### Bug Fixes

- **readme**: Try to fix syntax
  ([`8aa8c9e`](https://github.com/Kitware/trame-vtklocal/commit/8aa8c9eb615d987883f8f4f4eafd7ae85a51a556))


## v0.6.8 (2025-01-01)

### Bug Fixes

- **pyproject**: Fix long description error
  ([`19889bb`](https://github.com/Kitware/trame-vtklocal/commit/19889bb70a1ebc7ac5b766b9fd0de52eb7500745))

### Continuous Integration

- Pyproject syntax error
  ([`3945194`](https://github.com/Kitware/trame-vtklocal/commit/39451942b2f9e52f88aef6052fcaaf7b1c0841b6))


## v0.6.7 (2025-01-01)

### Bug Fixes

- **py**: Use ruff and pyproject
  ([`062a07d`](https://github.com/Kitware/trame-vtklocal/commit/062a07d2ebd212e20e9814197f1e90d2cda2552d))

### Continuous Integration

- Disable rendering test for now
  ([`a160b69`](https://github.com/Kitware/trame-vtklocal/commit/a160b6979efcfbabdf359109345837da8d754c4f))

- Fix action indent issue
  ([`06a06f4`](https://github.com/Kitware/trame-vtklocal/commit/06a06f4af39895691a422f7cbbca6ac54a0323ad))

- **osmesa**: Install osmesa for vtk
  ([`b8a1415`](https://github.com/Kitware/trame-vtklocal/commit/b8a1415ff0670c4c3578abddf51ead9296842b18))

- **test**: Add image comparison testing
  ([`90e2647`](https://github.com/Kitware/trame-vtklocal/commit/90e264737a6ce629b7b898572b91d7d8feb03ba2))

### Documentation

- **readme**: Improve readme
  ([`b18485b`](https://github.com/Kitware/trame-vtklocal/commit/b18485b9289c8135a315383275cf26ab2fd6c9c0))

- **README**: Update link to docxygen instead of code
  ([`a71c572`](https://github.com/Kitware/trame-vtklocal/commit/a71c572c025a2d840b500e0ddc3b3a02d149946b))


## v0.6.6 (2024-12-06)

### Bug Fixes

- **dep**: Add vtk as optional dep
  ([`7caa200`](https://github.com/Kitware/trame-vtklocal/commit/7caa200e441d9d3fe8734225113591c1d31596f1))

### Chores

- **build**: Enable logging in VTK
  ([`a28007d`](https://github.com/Kitware/trame-vtklocal/commit/a28007d63c8d83af4166fd5a2533f8063b235413))

### Documentation

- **examples**: Register camera orientation widget with vtk scene manager
  ([`d2eb35c`](https://github.com/Kitware/trame-vtklocal/commit/d2eb35c69472cff52790e82c3860df6b8dfab7d4))

- **readme**: Improve readme
  ([`06991ca`](https://github.com/Kitware/trame-vtklocal/commit/06991ca191dac2f05bcf3b8729a1bead9b514dbb))

- **readme**: Improve readme
  ([`f7bca26`](https://github.com/Kitware/trame-vtklocal/commit/f7bca269e6e6cd12a9acbc366e177343a54545e9))

- **readme**: Improve readme
  ([`20d1881`](https://github.com/Kitware/trame-vtklocal/commit/20d1881065bc5409427baba5b4bde6fccd18cb40))


## v0.6.5 (2024-11-16)

### Bug Fixes

- **mtime**: Prevent raise condition
  ([`68b7dcf`](https://github.com/Kitware/trame-vtklocal/commit/68b7dcf054ead3cdde613996926bc6294e8b45e4))


## v0.6.4 (2024-11-15)

### Bug Fixes

- **osmesa**: Allow server to use osmesa
  ([`cd77285`](https://github.com/Kitware/trame-vtklocal/commit/cd77285a2f9e35f9b908d17c0cd6423c52f0dc64))

### Documentation

- **examples**: Add VTK polydata file viewer
  ([`d8e18eb`](https://github.com/Kitware/trame-vtklocal/commit/d8e18ebd6ce8cf2f23d04b85836d408946718115))

- **examples**: Bump trame-vtklocal version to 0.6.3
  ([`d342c3a`](https://github.com/Kitware/trame-vtklocal/commit/d342c3a72534b5410779403d4aba7c8b11b1c896))


## v0.6.3 (2024-11-15)

### Bug Fixes

- **jslib**: Use default window size
  ([`d90a033`](https://github.com/Kitware/trame-vtklocal/commit/d90a0338c419f37ef8d82ecfcc80b9124d11e936))

- this commit fixes a TypeError that happened during first wasm scene update

### Documentation

- **js-lib**: Update version in dep
  ([`f9c8fb5`](https://github.com/Kitware/trame-vtklocal/commit/f9c8fb53f3329bc5ce57cb801dd7bb2a269764d1))

- **README**: Update vtk version to use 9.4
  ([`8a3fc72`](https://github.com/Kitware/trame-vtklocal/commit/8a3fc72637917a157ae416771914884b2cc2eabd))


## v0.6.2 (2024-10-15)

### Bug Fixes

- **update**: Prevent intermixed render with wrong size
  ([`180e1e4`](https://github.com/Kitware/trame-vtklocal/commit/180e1e48d7e7bae78e686d44b06f19d5d447274f))

### Documentation

- **example**: Update readme
  ([`491962f`](https://github.com/Kitware/trame-vtklocal/commit/491962f25b9093610d3f9a5d2a0b97087539dffe))

- **js-lib**: Update example with new api
  ([`d0e638e`](https://github.com/Kitware/trame-vtklocal/commit/d0e638e452bfecbee829e5598b9f44d5c3157656))

- **js-only**: Add example js-only
  ([`dfe79eb`](https://github.com/Kitware/trame-vtklocal/commit/dfe79eb6abdc857321e4cc9667fc5cdc17c07ee0))

- **offscreen**: Update examples
  ([`0fbb786`](https://github.com/Kitware/trame-vtklocal/commit/0fbb7864880298a8ef9678dd4fe18815970ea9a3))


## v0.6.1 (2024-10-07)

### Bug Fixes

- **wasm**: Add support for many canvas
  ([`cba9985`](https://github.com/Kitware/trame-vtklocal/commit/cba9985ec1b916f1b7ccfba2ed836d3db0365242))

### Chores

- **js-lib**: Clean pkg
  ([`a2aea16`](https://github.com/Kitware/trame-vtklocal/commit/a2aea16b9fd898bc308aab8b5f4a3aed6fc32451))

- **js-lib**: Publish new version
  ([`f762434`](https://github.com/Kitware/trame-vtklocal/commit/f762434417bf3ddb9be8ac0f8577f6f31d30eba4))


## v0.6.0 (2024-09-23)

### Continuous Integration

- **npm**: Publish to npm
  ([`2beba06`](https://github.com/Kitware/trame-vtklocal/commit/2beba06e895815857e6a02e332388908f0dd7ed3))

### Features

- **js**: Enable generic JS library as core
  ([`22aabae`](https://github.com/Kitware/trame-vtklocal/commit/22aabae31fd51beb0fa867deaa171bfc96db3887))


## v0.5.7 (2024-09-23)

### Bug Fixes

- **threaded**: Remove threaded option selection
  ([`f654055`](https://github.com/Kitware/trame-vtklocal/commit/f654055b67573ba85fcbddf718707990b7af8163))

### Documentation

- **example**: Add more examples
  ([`c3bfb11`](https://github.com/Kitware/trame-vtklocal/commit/c3bfb11f94d8e9cae83e27ecaa4ce4a205b8c5b1))

- **example**: Update streamline example
  ([`01625d1`](https://github.com/Kitware/trame-vtklocal/commit/01625d13e11aeee04bcfb86acf82f0b4e65ceca3))

- **example**: Update streamline widget example
  ([`acc568d`](https://github.com/Kitware/trame-vtklocal/commit/acc568d382d337af490e6bd3d22c340f98f9ef56))

- **issue**: Add examples/issues/14.py
  ([`191227c`](https://github.com/Kitware/trame-vtklocal/commit/191227ced175af5463e5b775c13b7afa63bdf6e2))


## v0.5.6 (2024-09-12)

### Bug Fixes

- **listeners**: Delay binding after update
  ([`a3b7e3e`](https://github.com/Kitware/trame-vtklocal/commit/a3b7e3ec63133721a3419d9d139811b9e9ba1bc5))

### Documentation

- **widget**: Update box example listener with corners property
  ([`4325647`](https://github.com/Kitware/trame-vtklocal/commit/432564793ca825846ec55b07dcaf76f1cc2e499a))


## v0.5.5 (2024-08-28)

### Bug Fixes

- **api**: Render_throttle replaced by update_throttle
  ([`d70e1bc`](https://github.com/Kitware/trame-vtklocal/commit/d70e1bcfacfddc95d4ea988d3c6f84115638f9c8))

### Documentation

- **example**: Update cone
  ([`6de605b`](https://github.com/Kitware/trame-vtklocal/commit/6de605b487539a90f4216dc44bbb466f75f33eb4))

- **example**: Update cone
  ([`4ee78ee`](https://github.com/Kitware/trame-vtklocal/commit/4ee78eeb73a403a1869853e072bd1b59bc8d5111))


## v0.5.4 (2024-08-28)

### Bug Fixes

- **doc**: Update doc string
  ([`80b2644`](https://github.com/Kitware/trame-vtklocal/commit/80b26447a48ee27847d4d7174416d9ba8c6af2d5))

### Documentation

- **readme**: Update shared array buffer section
  ([`07220e4`](https://github.com/Kitware/trame-vtklocal/commit/07220e438a2a3c9cbf9177f69a95ff572a20c01b))

- **widget**: Update box example
  ([`30215ea`](https://github.com/Kitware/trame-vtklocal/commit/30215eaa008c18ce28a3a8a1bcdf63f09e967050))


## v0.5.3 (2024-08-27)

### Bug Fixes

- **client**: Remove unnecessary calls to unregister state
  ([`e33f958`](https://github.com/Kitware/trame-vtklocal/commit/e33f958250fee0a417af6550ff8ee54269eced5c))

### Chores

- **dev**: Simplify VTK build script
  ([`7555539`](https://github.com/Kitware/trame-vtklocal/commit/75555398d5e1c20f64794c541257451e1cbb74a8))

### Documentation

- **widget**: Update example to be less annoying
  ([`fcf8a4a`](https://github.com/Kitware/trame-vtklocal/commit/fcf8a4a49fb18486c65bde71ab8af65e700071ab))


## v0.5.2 (2024-08-27)

### Bug Fixes

- **api**: Update listeners structure
  ([`f2a89c9`](https://github.com/Kitware/trame-vtklocal/commit/f2a89c9e4b829c3710a10d5961aa350d552be05d))


## v0.5.1 (2024-08-26)

### Bug Fixes

- **listeners**: Allow dynamic update
  ([`ab3b640`](https://github.com/Kitware/trame-vtklocal/commit/ab3b640e0d5af761efdd9a554117c91a3b45be2e))


## v0.5.0 (2024-08-26)

### Chores

- **ci**: Fix precommit
  ([`f9da1a3`](https://github.com/Kitware/trame-vtklocal/commit/f9da1a36b999773097c887a0ea4f28ebc1ef771d))

### Documentation

- **example**: Fix plane and box
  ([`0d0cd02`](https://github.com/Kitware/trame-vtklocal/commit/0d0cd02505e0d5b188dc8d65ae9ce7eeee2e01f5))

### Features

- **listeners**: Initial support with static definition
  ([`7e0da92`](https://github.com/Kitware/trame-vtklocal/commit/7e0da9226ec349fce462c9c0dc189f65d2dce565))


## v0.4.0 (2024-08-23)

### Bug Fixes

- **camera**: Camera event working now
  ([`6807b54`](https://github.com/Kitware/trame-vtklocal/commit/6807b5468f9b57a46c1ce2fdb77072d4bb58ce26))

- **camera**: Sync only camera state
  ([`b03dbcf`](https://github.com/Kitware/trame-vtklocal/commit/b03dbcfb3a34ffdeb9b24f0be42799be7a9e9e61))

- requires https://gitlab.kitware.com/vtk/vtk/-/merge_requests/11398

- **camera**: Try to send camera update
  ([`7238b25`](https://github.com/Kitware/trame-vtklocal/commit/7238b25fb96cb159095b99a38522530e22d96e25))

- **example**: Enable http headers
  ([`78d2c63`](https://github.com/Kitware/trame-vtklocal/commit/78d2c632baadd87ad6d9b210eb5f09ef09a46a19))

- **example**: Sync client camera on server
  ([`931ce43`](https://github.com/Kitware/trame-vtklocal/commit/931ce4388537f82bb2afe2415dc3b75c4382044f))

- **examples**: Examples reviewed
  ([`9df7733`](https://github.com/Kitware/trame-vtklocal/commit/9df7733d9b9ac747c46256f4b9c46cdf1cde8768))

- **SharedArrayBuffer**: Automatically swicth based on server flag
  ([`521024e`](https://github.com/Kitware/trame-vtklocal/commit/521024e606bdfe7fc949c9679d79916e0d25cdf5))

- **widgets**: Handle registration and state delivery
  ([`f4f878d`](https://github.com/Kitware/trame-vtklocal/commit/f4f878d64f487d050c1c151462f05ec62e04a374))

- **widgets**: Update state after widget is registered
  ([`5a9f677`](https://github.com/Kitware/trame-vtklocal/commit/5a9f67768ea0ae1bfb02446e42fbbf0516f95030))

### Chores

- **development**: Add scripts to build with custom VTK
  ([`12a44da`](https://github.com/Kitware/trame-vtklocal/commit/12a44da6db4bef527b3bfd8df82015db500cde1c))

- **devscript**: Update build_vtk.sh
  ([`7ed4831`](https://github.com/Kitware/trame-vtklocal/commit/7ed48316dc98c570b3242b818f293bc5a1c1b8ca))

- Uses newer VTK CI image for wasm32 builds - Adds CLI arguments to customize VTK git url, branch,
  build type and build target. - Update README.rst with new instructions.

### Documentation

- **glyph**: Update to add reset camera buttons
  ([`d9cb473`](https://github.com/Kitware/trame-vtklocal/commit/d9cb47327de349539998dca3a12bcc2c48473b13))

### Features

- **camera**: Allow to push camera from server
  ([`e95249b`](https://github.com/Kitware/trame-vtklocal/commit/e95249b2ea369be0a4afbe6b3d502e71f6dab873))


## v0.3.3 (2024-05-27)

### Bug Fixes

- **reset_camera**: Connect reset_camera call
  ([`010d396`](https://github.com/Kitware/trame-vtklocal/commit/010d39634f7f74205b2280d1096fc412761edd48))


## v0.3.2 (2024-05-05)

### Bug Fixes

- **wasm**: Use env var to copy vtk wasm binaries for development
  ([`2a36678`](https://github.com/Kitware/trame-vtklocal/commit/2a36678af4227ce6cdf7c9e927612ebc6321f40b))


## v0.3.1 (2024-05-05)

### Bug Fixes

- **wasm**: Do not throw exception when get request succeeds
  ([`3f4c02f`](https://github.com/Kitware/trame-vtklocal/commit/3f4c02f45b10aaae02f97cd29d9532d8c5177d57))


## v0.3.0 (2024-05-05)

### Features

- **wasm**: Allow loading custom vtk-wasm tarball
  ([`9cc5ca1`](https://github.com/Kitware/trame-vtklocal/commit/9cc5ca12a71191253873d6f6d6e3304912485baa))


## v0.2.0 (2024-05-02)

### Documentation

- **examples**: Add missing dep in requirements.txt
  ([`f1a2055`](https://github.com/Kitware/trame-vtklocal/commit/f1a205570f36c33f1110f4cfb4fc69084f747953))

- **examples**: Make the WASM switch from os.env
  ([`0d75b08`](https://github.com/Kitware/trame-vtklocal/commit/0d75b08e59cdf772617dd45f036c6287f63e139e))

- **examples**: More pyvista examples
  ([`a6f93a8`](https://github.com/Kitware/trame-vtklocal/commit/a6f93a8686e5828de1959fdc95ae5365cf60ccbf))

### Features

- **export**: Add export capability from widget
  ([`86857d2`](https://github.com/Kitware/trame-vtklocal/commit/86857d2609e4be9b3f7622b207dacf4b74a74634))


## v0.1.0 (2024-04-19)

### Bug Fixes

- Code cleanup and fix resize
  ([`e00a44d`](https://github.com/Kitware/trame-vtklocal/commit/e00a44da7a9718637466d1db4579571e21c8d49d))

- Prevent concurrent update
  ([`67cd840`](https://github.com/Kitware/trame-vtklocal/commit/67cd840caa310189c4b2060d8ad74d4f75fd7077))

- **api**: Return true/false for event loop functions
  ([`db8f1fe`](https://github.com/Kitware/trame-vtklocal/commit/db8f1fe0b0c61af44c0d2f62e1ff25affae35512))

- **api**: Use explicit UpdateStatesFromObjects instead of Update
  ([`b50eeaa`](https://github.com/Kitware/trame-vtklocal/commit/b50eeaa17465a0f20300171e50be2480ef08dd4c))

- **api**: Use startEventLoop method to begin event processing
  ([`55470b8`](https://github.com/Kitware/trame-vtklocal/commit/55470b83dcfe5e991c1dea8194c44dcef21bf3d8))

- **client**: Client starting to work
  ([`1dba35c`](https://github.com/Kitware/trame-vtklocal/commit/1dba35c98abd46fb0a6edb0300712c79e258334d))

- **client**: Force id on canvas
  ([`fe7dc25`](https://github.com/Kitware/trame-vtklocal/commit/fe7dc2567f7eb4978e6ea4df1130a06767e01172))

- **examples**: Update some examples
  ([`1878952`](https://github.com/Kitware/trame-vtklocal/commit/1878952d993136015dc57d6334c39a0f0f168b35))

- **resize**: Allow initial size
  ([`a8ffd63`](https://github.com/Kitware/trame-vtklocal/commit/a8ffd63fdec2b03ada70b27fd3411db6987169bd))

### Chores

- **example**: Cleanup
  ([`166506f`](https://github.com/Kitware/trame-vtklocal/commit/166506f4bc69d592e1a96c1501f0604b4d505058))

### Continuous Integration

- Add missing dependency
  ([`1ec7ac9`](https://github.com/Kitware/trame-vtklocal/commit/1ec7ac91bbf41c80bbb07dd862e6684f1c19f6f0))

- Add missing dependency
  ([`3e29201`](https://github.com/Kitware/trame-vtklocal/commit/3e29201e60329c6e83ba2d0a410a13a46c1cae09))

- Add missing test dependency
  ([`5c732ad`](https://github.com/Kitware/trame-vtklocal/commit/5c732ad47f00521f36d84a9c84613f22fc24a134))

- Ignore
  ([`95c1c87`](https://github.com/Kitware/trame-vtklocal/commit/95c1c87bf1edd1cfb8b8f88e83f09cf6dcd321da))

- Use extra-index
  ([`8c51912`](https://github.com/Kitware/trame-vtklocal/commit/8c51912d7ef1391bffc7675e1f0d613d6519d06d))

### Documentation

- **example**: More examples
  ([`6243b23`](https://github.com/Kitware/trame-vtklocal/commit/6243b23de78fb66ea1b582aa7c496adc054c4d32))

- **example**: More testing examples
  ([`8c43421`](https://github.com/Kitware/trame-vtklocal/commit/8c434213fe594de05d01a281fa2bae9b42ba0759))

- **examples**: Add more widgets examples
  ([`5ace5a7`](https://github.com/Kitware/trame-vtklocal/commit/5ace5a71008ceb42a8e52d92256472ce5e154b92))

- **examples**: Add more widgets examples
  ([`bb81cef`](https://github.com/Kitware/trame-vtklocal/commit/bb81cefae5e7b04da5bfc086c8d4374b855ae45e))

- **pv**: Add paraview example
  ([`4fc7545`](https://github.com/Kitware/trame-vtklocal/commit/4fc7545d6a2080043683882867cdcf0cae15b956))

- **readme**: Add --extra-index-url so vtk-wasm can be found
  ([`e53ba33`](https://github.com/Kitware/trame-vtklocal/commit/e53ba33831abf34f3eeb4ca03ea9acb044aadc93))

### Features

- Vtk-wasm component for mirroring server rendering
  ([`0dd567a`](https://github.com/Kitware/trame-vtklocal/commit/0dd567a4eca36451e4c679ec277c975e16e99f4b))

- **camera**: Ignore camera state during deserialization
  ([`27c80e1`](https://github.com/Kitware/trame-vtklocal/commit/27c80e1dca552a88bed917c0e6cc024846495bef))

- **eager-sync**: Allow server push for scene sync
  ([`03c481a`](https://github.com/Kitware/trame-vtklocal/commit/03c481aa3e0a6838fa400b57f48631bd74771035))

- **memory**: Free memory automatically
  ([`1efa6b4`](https://github.com/Kitware/trame-vtklocal/commit/1efa6b44af9ffe2c72d534b7de8ed66454589938))

- **resize**: Correctly set canvas width and height
  ([`4b9ec9e`](https://github.com/Kitware/trame-vtklocal/commit/4b9ec9e90e9a3775968998592f103dcb3cfe30a2))

- **resize**: Fix size conflict by forwarding canvas size to wasm vtk render window.
  ([`7281930`](https://github.com/Kitware/trame-vtklocal/commit/72819304235987c1fd82fd6914a77cc54f5859dc))

- **vtk-wasm**: Rely on vtk-wasm wheel
  ([`3728849`](https://github.com/Kitware/trame-vtklocal/commit/37288498590e258c3e756f20a8af7448ae146c04))

- **wasm**: Auto download compatible wasm bundle
  ([`7c72650`](https://github.com/Kitware/trame-vtklocal/commit/7c72650af0f6228c8ee681b20c811ee79c9609d2))

- **wasm**: Do not keep track of active ids.
  ([`37d00dd`](https://github.com/Kitware/trame-vtklocal/commit/37d00dd66db0ab4ef39dfda51aea8f7f5429df73))

- **wasm**: Externalize it better
  ([`41ff3a2`](https://github.com/Kitware/trame-vtklocal/commit/41ff3a2c401a80124db00d9ce7c602241f8c6bb2))

- **wasm**: Update wasm file
  ([`fc63f26`](https://github.com/Kitware/trame-vtklocal/commit/fc63f26848b21fd45ad2cb57144120511fbe4f94))

- **wasm**: Use string identifiers with object manager
  ([`86c5789`](https://github.com/Kitware/trame-vtklocal/commit/86c578967d254fc0b5e21a27be252a954461ff18))

- **wasm**: Use vtkSceneManager
  ([`d970298`](https://github.com/Kitware/trame-vtklocal/commit/d97029846ddfdda5fc7706120f797e5f31621e5f))
