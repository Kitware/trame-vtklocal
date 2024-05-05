# Changelog

<!--next-version-placeholder-->

## v0.3.2 (2024-05-05)

### Fix

* **wasm:** Use env var to copy vtk wasm binaries for development ([`2a36678`](https://github.com/Kitware/trame-vtklocal/commit/2a36678af4227ce6cdf7c9e927612ebc6321f40b))

## v0.3.1 (2024-05-05)

### Fix

* **wasm:** Do not throw exception when get request succeeds ([`3f4c02f`](https://github.com/Kitware/trame-vtklocal/commit/3f4c02f45b10aaae02f97cd29d9532d8c5177d57))

## v0.3.0 (2024-05-05)

### Feature

* **wasm:** Allow loading custom vtk-wasm tarball ([`9cc5ca1`](https://github.com/Kitware/trame-vtklocal/commit/9cc5ca12a71191253873d6f6d6e3304912485baa))

## v0.2.0 (2024-05-02)

### Feature

* **export:** Add export capability from widget ([`86857d2`](https://github.com/Kitware/trame-vtklocal/commit/86857d2609e4be9b3f7622b207dacf4b74a74634))

### Documentation

* **examples:** Add missing dep in requirements.txt ([`f1a2055`](https://github.com/Kitware/trame-vtklocal/commit/f1a205570f36c33f1110f4cfb4fc69084f747953))
* **examples:** More pyvista examples ([`a6f93a8`](https://github.com/Kitware/trame-vtklocal/commit/a6f93a8686e5828de1959fdc95ae5365cf60ccbf))
* **examples:** Make the WASM switch from os.env ([`0d75b08`](https://github.com/Kitware/trame-vtklocal/commit/0d75b08e59cdf772617dd45f036c6287f63e139e))

## v0.1.0 (2024-04-19)

### Feature

* **wasm:** Auto download compatible wasm bundle ([`7c72650`](https://github.com/Kitware/trame-vtklocal/commit/7c72650af0f6228c8ee681b20c811ee79c9609d2))
* **eager-sync:** Allow server push for scene sync ([`03c481a`](https://github.com/Kitware/trame-vtklocal/commit/03c481aa3e0a6838fa400b57f48631bd74771035))
* **vtk-wasm:** Rely on vtk-wasm wheel ([`3728849`](https://github.com/Kitware/trame-vtklocal/commit/37288498590e258c3e756f20a8af7448ae146c04))
* **wasm:** Update wasm file ([`fc63f26`](https://github.com/Kitware/trame-vtklocal/commit/fc63f26848b21fd45ad2cb57144120511fbe4f94))
* **wasm:** Use vtkSceneManager ([`d970298`](https://github.com/Kitware/trame-vtklocal/commit/d97029846ddfdda5fc7706120f797e5f31621e5f))
* **memory:** Free memory automatically ([`1efa6b4`](https://github.com/Kitware/trame-vtklocal/commit/1efa6b44af9ffe2c72d534b7de8ed66454589938))
* **camera:** Ignore camera state during deserialization ([`27c80e1`](https://github.com/Kitware/trame-vtklocal/commit/27c80e1dca552a88bed917c0e6cc024846495bef))
* **resize:** Correctly set canvas width and height ([`4b9ec9e`](https://github.com/Kitware/trame-vtklocal/commit/4b9ec9e90e9a3775968998592f103dcb3cfe30a2))
* **wasm:** Do not keep track of active ids. ([`37d00dd`](https://github.com/Kitware/trame-vtklocal/commit/37d00dd66db0ab4ef39dfda51aea8f7f5429df73))
* **resize:** Fix size conflict by forwarding canvas size to wasm vtk render window. ([`7281930`](https://github.com/Kitware/trame-vtklocal/commit/72819304235987c1fd82fd6914a77cc54f5859dc))
* **wasm:** Use string identifiers with object manager ([`86c5789`](https://github.com/Kitware/trame-vtklocal/commit/86c578967d254fc0b5e21a27be252a954461ff18))
* **wasm:** Externalize it better ([`41ff3a2`](https://github.com/Kitware/trame-vtklocal/commit/41ff3a2c401a80124db00d9ce7c602241f8c6bb2))
* Vtk-wasm component for mirroring server rendering ([`0dd567a`](https://github.com/Kitware/trame-vtklocal/commit/0dd567a4eca36451e4c679ec277c975e16e99f4b))

### Fix

* **api:** Return true/false for event loop functions ([`db8f1fe`](https://github.com/Kitware/trame-vtklocal/commit/db8f1fe0b0c61af44c0d2f62e1ff25affae35512))
* Code cleanup and fix resize ([`e00a44d`](https://github.com/Kitware/trame-vtklocal/commit/e00a44da7a9718637466d1db4579571e21c8d49d))
* **api:** Use explicit UpdateStatesFromObjects instead of Update ([`b50eeaa`](https://github.com/Kitware/trame-vtklocal/commit/b50eeaa17465a0f20300171e50be2480ef08dd4c))
* **api:** Use startEventLoop method to begin event processing ([`55470b8`](https://github.com/Kitware/trame-vtklocal/commit/55470b83dcfe5e991c1dea8194c44dcef21bf3d8))
* **examples:** Update some examples ([`1878952`](https://github.com/Kitware/trame-vtklocal/commit/1878952d993136015dc57d6334c39a0f0f168b35))
* Prevent concurrent update ([`67cd840`](https://github.com/Kitware/trame-vtklocal/commit/67cd840caa310189c4b2060d8ad74d4f75fd7077))
* **resize:** Allow initial size ([`a8ffd63`](https://github.com/Kitware/trame-vtklocal/commit/a8ffd63fdec2b03ada70b27fd3411db6987169bd))
* **client:** Force id on canvas ([`fe7dc25`](https://github.com/Kitware/trame-vtklocal/commit/fe7dc2567f7eb4978e6ea4df1130a06767e01172))
* **client:** Client starting to work ([`1dba35c`](https://github.com/Kitware/trame-vtklocal/commit/1dba35c98abd46fb0a6edb0300712c79e258334d))

### Documentation

* **pv:** Add paraview example ([`4fc7545`](https://github.com/Kitware/trame-vtklocal/commit/4fc7545d6a2080043683882867cdcf0cae15b956))
* **readme:** Add --extra-index-url so vtk-wasm can be found ([`e53ba33`](https://github.com/Kitware/trame-vtklocal/commit/e53ba33831abf34f3eeb4ca03ea9acb044aadc93))
* **example:** More examples ([`6243b23`](https://github.com/Kitware/trame-vtklocal/commit/6243b23de78fb66ea1b582aa7c496adc054c4d32))
* **examples:** Add more widgets examples ([`5ace5a7`](https://github.com/Kitware/trame-vtklocal/commit/5ace5a71008ceb42a8e52d92256472ce5e154b92))
* **examples:** Add more widgets examples ([`bb81cef`](https://github.com/Kitware/trame-vtklocal/commit/bb81cefae5e7b04da5bfc086c8d4374b855ae45e))
* **example:** More testing examples ([`8c43421`](https://github.com/Kitware/trame-vtklocal/commit/8c434213fe594de05d01a281fa2bae9b42ba0759))
