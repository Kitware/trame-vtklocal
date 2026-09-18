#!/usr/bin/env -S uv run --script
#
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "trame>=3.13.2",
#     "trame-vtklocal>=1.6.3",
#     "vtk>=9.7",
# ]
#
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
# ///

import vtk
from trame_vtklocal.utils import exporter


def build_vtk_pipeline():
    renderer = vtk.vtkRenderer()
    rw = vtk.vtkRenderWindow()
    rw.AddRenderer(renderer)
    rwi = vtk.vtkRenderWindowInteractor(render_window=rw)
    rwi.interactor_style.SetCurrentStyleToTrackballCamera()

    cone = vtk.vtkConeSource()

    mapper = vtk.vtkPolyDataMapper(input_connection=cone.output_port)
    actor = vtk.vtkActor(mapper=mapper)

    renderer.AddActor(actor)
    renderer.background = (0.1, 0.2, 0.4)
    renderer.ResetCamera()

    return rw


def main():
    rw = build_vtk_pipeline()

    exporter.to_wazex(
        vtk_objects=[rw],
        output="cone.wazex",
    )
    exporter.to_html(
        vtk_objects=[rw],
        output="cone.html",
    )
    exporter.create_viewer("wasm-viewer.html")


if __name__ == "__main__":
    main()
