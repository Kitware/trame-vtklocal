from trame.app import get_server
from trame.ui.html import DivLayout
from trame.widgets import html, client
from trame_vtklocal.widgets import vtklocal
from trame.decorators import TrameApp

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
    ids_to_register = []
    render_window_id = 1
    with open(state_file, "r") as f:
        states = json.load(f)
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
    manager.Import(state_file, blob_file)
    manager.UpdateObjectsFromStates()

    return manager.GetObjectAtId(render_window_id), [
        manager.GetObjectAtId(_id) for _id in ids_to_register
    ]


@TrameApp()
class SnapshotViewer:
    def __init__(self, server=None):
        """Initialize the SnapshotViewer application."""

        self.server = get_server(server, client_type=CLIENT_TYPE)
        self.server.cli.add_argument("-s", "--state", required=True)
        self.server.cli.add_argument("-b", "--blob", required=True)
        args, _ = self.server.cli.parse_known_args()

        self.render_window, self.objects_to_register = import_snapshot(
            args.state, args.blob
        )
        self.html_view = None
        self.ui = self._ui()
        # print(self.ui)

    def _ui(self):
        with DivLayout(self.server) as layout:
            client.Style("body { margin: 0; }")
            with html.Div(
                style="position: absolute; top: 0; left: 0; width: 100%; height: 100vh;"
            ):
                self.html_view = vtklocal.LocalView(
                    self.render_window,
                )
                for obj in self.objects_to_register:
                    self.html_view.register_vtk_object(obj)

        return layout


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------


if __name__ == "__main__":
    app = SnapshotViewer()
    app.server.start()
