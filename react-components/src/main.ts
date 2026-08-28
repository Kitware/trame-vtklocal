import type { ComponentType } from "react";

import VtkLocal from "./components/VtkLocal";

interface Registry {
  register(tag: string, component: ComponentType<any>): void;
}

export function install(registry: Registry) {
  registry.register("vtk-local", VtkLocal);
}
