# ParaView support

Not Supported yet but we hope to get it working with 5.14 or nightly after 5.13 release.

## Setup 

```
python3.10 -m venv .venv-pv
source ./.venv-pv/bin/activate
pip install trame trame-vtklocal
```

## Running ParaView example

```
export PV_VENV=$PWD/.venv-pv
/.../pvpython ./cone.py
```
