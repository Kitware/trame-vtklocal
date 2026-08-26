#!/usr/bin/env -S uv run --script
#
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "trame>=3.13.2",
#     "trame-vtklocal>=1.3",
#     "vtk>=9.7",
# ]
#
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
# ///

from pathlib import Path
from trame.app import TrameApp
from trame.ui.html import DivLayout
from trame.widgets import client, vtklocal

from vtkmodules.vtkSerializationManager import vtkObjectManager

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa

import json

CLIENT_TYPE = "vue3"


def import_snapshot(state_file, blob_file):
    """
    Imports a VTK snapshot from the specified state and blob files.
    This function reads a JSON state file and a corresponding binary blob file to reconstruct
    VTK objects and their states. It identifies objects that are marked to be kept alive
    (e.g., interactive 3D widgets) and returns them in a list.
    Returns:
        tuple:
            - The primary VTK object (typically with ID 1).
            - A list of VTK objects that are marked "vtk-object-manager-kept-alive".
    Raises:
        FileNotFoundError: If the state or blob file does not exist.
        json.JSONDecodeError: If the state file is not a valid JSON.
    """
    state_file = Path(state_file).resolve()
    blob_file = Path(blob_file).resolve()
    ids_to_register = []
    render_window_id = 1

    # Extract ids to keep around
    states = json.loads(state_file.read_text())
    for _id, obj in states.items():
        if obj.get("vtk-object-manager-kept-alive", False):
            # This is a kept alive object (ex: a 3D VTK widget).
            # we need to pass it to the VTK local view using the register_vtk_object method
            ids_to_register.append(int(_id))
        if "vtkRenderWindow" in obj.get("SuperClassNames"):
            # This is the render window object
            render_window_id = int(_id)

    manager = vtkObjectManager()
    manager.Initialize()
    manager.Import(str(state_file), str(blob_file))
    manager.UpdateObjectsFromStates()

    return manager.GetObjectAtId(render_window_id), [
        manager.GetObjectAtId(_id) for _id in ids_to_register
    ]


class SnapshotViewer(TrameApp):
    def __init__(self, server=None):
        """Initialize the SnapshotViewer application."""
        super().__init__(server, client_type=CLIENT_TYPE)
        self.server.cli.add_argument("-s", "--state", required=True)
        self.server.cli.add_argument("-b", "--blob", required=True)
        args, _ = self.server.cli.parse_known_args()

        self.render_window, objects_to_register = import_snapshot(args.state, args.blob)
        self._build_ui()
        for obj in objects_to_register:
            self.ctx.view.register_vtk_object(obj)

    def _build_ui(self):
        with DivLayout(self.server) as self.ui:
            client.Style("body { margin: 0; }")
            self.ui.root.style = "height:100vh;"
            vtklocal.LocalView(
                self.render_window,
                ctx_name="view",
            )


if __name__ == "__main__":
    app = SnapshotViewer()
    app.server.start()
