"""Manage the VTK WebAssembly files used by trame-vtklocal.

Usage:
    python -m trame_vtklocal.wasm download [--dest DIR] [--wasm-bits wasm32 wasm64]

Without --dest, files go where trame-vtklocal looks for them at runtime: the
package serve directory if it is writable, otherwise the user cache directory.
"""

import argparse
import sys
from pathlib import Path

from trame_vtklocal.module.wasm import download_wasm, get_wasm_cache_directory

SERVE_PATH = Path(__file__).with_name("module") / "serve"


def download(args):
    dest = args.dest or get_wasm_cache_directory(str(SERVE_PATH.resolve()))
    for wasm_bits in args.wasm_bits:
        directory = download_wasm(
            dest, wasm_bits=wasm_bits, wasm_url=args.url, force=args.force
        )
        print(f"{wasm_bits}: {directory}")


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="python -m trame_vtklocal.wasm",
        description="Manage the VTK WebAssembly files used by trame-vtklocal",
    )
    commands = parser.add_subparsers(dest="command", required=True)

    cmd = commands.add_parser(
        "download",
        help="Download the VTK WebAssembly files for the installed VTK version",
    )
    cmd.add_argument(
        "--dest",
        help="Directory to download into (default: trame-vtklocal's wasm directory)",
    )
    cmd.add_argument(
        "--wasm-bits",
        nargs="+",
        choices=["wasm32", "wasm64"],
        default=["wasm32", "wasm64"],
        help="Architectures to download (default: both, as used at runtime)",
    )
    cmd.add_argument("--url", help="Override the download URL")
    cmd.add_argument(
        "--force",
        action="store_true",
        help="Download even if the files already exist",
    )
    cmd.set_defaults(func=download)

    args = parser.parse_args(argv)
    if args.command == "download" and args.url and len(args.wasm_bits) > 1:
        parser.error("--url requires a single --wasm-bits value")
    try:
        args.func(args)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
