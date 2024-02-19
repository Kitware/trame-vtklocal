from trame_vtklocal.widgets.vtklocal import *


def initialize(server):
    from trame_vtklocal import module

    server.enable_module(module)
