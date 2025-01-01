from trame_vtklocal.widgets.vtklocal import *  # noqa F403


def initialize(server):
    from trame_vtklocal import module

    server.enable_module(module)
