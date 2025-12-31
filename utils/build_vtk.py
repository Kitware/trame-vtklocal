#
# This script is useful to test bleeding edge or forks of VTK with trame/vtk-local.
# By default, the project
# 1. installs the VTK wheels from pypi.org (examples/vtk/requirements.txt)
# 2. downloads the wasm binary gitlab package registry,
# both of which will not have your changes unless your topic is already merged
# in VTK upstream and a release has been cut.
#
# Tip:
#   You might want to point the `vtk_url` to your fork and checkout your branch instead of `master`.
#
# Usage:
#   Build wasm binaries:
#       python ./utils/build_vtk.py -u https://gitlab.kitware.com/vtk/vtk.git -b master -t wasm32 -c RelWithDebInfo
#   Build python libs:
#       python ./utils/build_vtk.py -u https://gitlab.kitware.com/vtk/vtk.git -b master -t py -c RelWithDebInfo
#
# After this script is completed,
#   set VTK_WASM_DIR_OVERRIDE=dev/vtk_${branch}/build/${build_type}/wasm/bin
#   set PYTHONPATH=dev/vtk_${branch}/build/${build_type}/py/lib/pythonx.y/site-packages

import argparse
import os
import platform
import subprocess
import sys


def check_tool_version(command, shell=False):
    try:
        version = (
            subprocess.check_output(
                [command, "--version"],
                stderr=subprocess.STDOUT,
                shell=shell,
            )
            .decode()
            .strip()
        )
        print(f"{command} version: {version}")
    except subprocess.CalledProcessError as e:
        print(f"{command} not found or failed to get version.")
        print(e)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Build VTK binaries")
    parser.add_argument(
        "-u",
        "--url",
        required=True,
        help="URL of the VTK git repository",
    )
    parser.add_argument(
        "-b",
        "--branch",
        required=True,
        help="Branch to checkout in the VTK repository",
    )
    parser.add_argument(
        "-t",
        "--target",
        choices=["wasm32", "py"],
        required=True,
        help="Build target (wasm32 or py)",
    )
    parser.add_argument(
        "-c",
        "--cmake-config",
        choices=["Debug", "Release", "RelWithDebInfo", "MinSizeRel"],
        required=True,
        help="CMake build configuration",
    )
    parser.add_argument(
        "-j",
        "--parallel",
        default="",
        help="Number of parallel jobs for building (default: all available cores)",
    )

    args = parser.parse_args()

    url = args.url
    branch = args.branch
    target = args.target
    cmake_config = args.cmake_config
    num_jobs = args.parallel

    # Clone inside ../dev/vtk-{branch}
    git_clone_dir = os.path.join(os.getcwd(), f"dev/vtk-{branch}")
    # Configure and build inside ../dev/vtk-{branch}/build
    build_dir = os.path.join("build", cmake_config, target)

    # Ensure directories exist
    if not os.path.exists("dev"):
        os.makedirs("dev")

    if not os.path.exists(git_clone_dir):
        subprocess.run(["git", "clone", url, git_clone_dir], check=True)

    subprocess.run(
        [
            "git",
            "config",
            "--global",
            "--add",
            "safe.directory",
            git_clone_dir,
        ],
        check=True,
    )

    os.chdir(git_clone_dir)
    # Checkout branch and update submodules
    subprocess.run(["git", "checkout", branch], check=True)
    subprocess.run(["git", "submodule", "update", "--init"], check=True)

    # Ensure required tools are available.
    check_tool_version("cmake")
    check_tool_version("ninja")

    if target == "wasm32":
        use_shell_for_emscripten_tools = platform.system() == "Windows"
        # Ensure Node.js and emcc are available
        check_tool_version("node")
        check_tool_version("emcc", shell=use_shell_for_emscripten_tools)

        # Build vtk.wasm binaries
        subprocess.run(
            [
                "emcmake",
                "cmake",
                "-S",
                ".",
                "-B",
                build_dir,
                "-GNinja",
                "-DCMAKE_BUILD_TYPE:STRING=" + cmake_config,
                "-DBUILD_SHARED_LIBS=OFF",
                "-DVTK_WRAP_SERIALIZATION=ON",
                "-DVTK_BUILD_EXAMPLES=OFF",
                "-DVTK_ENABLE_WEBGPU=ON",
            ],
            check=True,
            shell=use_shell_for_emscripten_tools,
        )

        subprocess.run(["cmake", "--build", build_dir, "-j", num_jobs], check=True)

    elif target == "py":
        # Build vtk python binaries
        subprocess.run(
            [
                "cmake",
                "-S",
                ".",
                "-B",
                build_dir,
                "-GNinja",
                "-DCMAKE_BUILD_TYPE:STRING=" + cmake_config,
                "-DVTK_WRAP_PYTHON=ON",
                "-DVTK_WRAP_SERIALIZATION=ON",
                "-DVTK_GROUP_ENABLE_Web=YES",
                # "-DVTK_BUILD_TESTING=ON",
            ],
            check=True,
        )

        subprocess.run(["cmake", "--build", build_dir, "-j", num_jobs], check=True)

    else:
        print(
            f"Unknown build target {target}. Only 'wasm32' and 'py' are supported",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
