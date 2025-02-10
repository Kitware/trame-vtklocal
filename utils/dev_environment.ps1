param (
    [string]$b,
    [string]$c
)

# Initialize variables
$branch = $b
$cmake_config = $c

# Validate required parameters
if (-not $branch -or -not $cmake_config) {
    Write-Host "ERROR Unrecognized argument or missing required parameters!"
    Write-Host "Usage: "
    Write-Host "      $PSCommandPath -b <branch> -c <cmake_config>"
    exit 1
}

# Define readonly variables
$git_clone_dir = "$(Get-Location)\dev\vtk-$branch"
$build_dir = "build\$cmake_config"

# Get Python version
$py_version = & {
    $version = python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
    return $version
}

# Set environment variables
$env:PYTHONPATH = "$git_clone_dir\$build_dir\py\lib\site-packages"
$env:VTK_WASM_DIR = "$git_clone_dir\$build_dir\wasm32\bin"
