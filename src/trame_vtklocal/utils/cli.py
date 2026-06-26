def add_wasm_config(cli):
    cli.add_argument(
        "--wasm-mode",
        default="wasm32",
        help="Choose between wasm32 and wasm64",
    )
    cli.add_argument(
        "--wasm-exec",
        default="sync",
        help="Choose between sync and async",
    )
    cli.add_argument(
        "--wasm-rendering",
        default="webgl",
        help="Choose between webgl and webgpu",
    )
    return cli.parse_known_args()[0]
