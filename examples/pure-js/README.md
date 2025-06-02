# Trame WASM in pure JS

This example aim to showcase the usage of trame on the server side with a pure JavaScript client.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install trame "trame-vtklocal>=0.12.3"
pip install "vtk==9.5.20250531.dev0" --extra-index-url https://wheels.vtk.org
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
# This will build the client side into ./dist
cd client
npm install
npm run build

# Copy the WASM code into ./dist/wasm (may need to fix the src path)
cp -r ../wasm-lib/9.5.20250531 ./dist/wasm

# Start the trame server with our JS client
python ../server.py --content ./dist --port 0

# Start the trame server that don't define a GUI
python ../server_nogui.py --content ./dist --port 0
```
