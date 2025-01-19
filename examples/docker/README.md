# Multi-user Docker Setup

This directory capture what is needed for setting up a docker image using vtklocal.

## Building the docker image

The following command lines assume to be ran within the directory containing this README.md

```
docker build --progress=plain  -t trame-wasm .
```

## Running image

```
docker run -p 8080:80 -it trame-wasm 
```

Then open your browser to `http://localhost:8080/`.