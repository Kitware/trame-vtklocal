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
