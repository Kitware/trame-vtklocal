# Trame WASM in pure JS

This example aim to showcase the usage of trame on the server side with a pure JavaScript client.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install trame trame-vtklocal
pip install "vtk==9.3.20241005.dev0" --extra-index-url https://wheels.vtk.org
```

## Running trame as client/server

This step is important to have trame-vtklocal retrieve the WASM module compatible with the VTK version that got installed in the previous step.

```bash
python ./server.py
```

After that initial execution, let's grab the JS+WASM bundle that match our VTK install.

```bash 
cp -r .venv/lib/python3.10/site-packages/trame_vtklocal/module/serve/wasm/ wasm-lib
```

## Configure pure JS client

This step aims to build the JS code and serve it inplace of the default trame client. 
Technically, this is not required but for simplicity we are suggesting that path.

```bash
# This will build the client side
cd client
npm install
npm run build

# This will start the trame server while serving the current JS
ln -s ../wasm-lib/9.3.20241005 ./dist/wasm
python ../server.py --content ./dist
```
