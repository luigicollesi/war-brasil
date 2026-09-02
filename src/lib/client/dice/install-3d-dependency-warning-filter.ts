import { getConsoleFunction, setConsoleFunction } from "three";

const RAPPIER_WASM_INIT_WARNING =
  "using deprecated parameters for the initialization function; pass a single object instead";
const THREE_CLOCK_WARNING =
  "THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.";
const INSTALL_STATE_KEY = "__warBrasilDice3DWarningFilterInstalled__";

type ThreeConsoleFunction = Parameters<typeof setConsoleFunction>[0];
type WarningFilterGlobal = typeof globalThis & {
  [INSTALL_STATE_KEY]?: boolean;
};

function forwardThreeMessage(
  type: "log" | "warn" | "error",
  message: string,
  params: readonly unknown[],
) {
  if (type === "warn") {
    console.warn(message, ...params);
    return;
  }
  if (type === "error") {
    console.error(message, ...params);
    return;
  }
  console.log(message, ...params);
}

/**
 * Temporary compatibility bridge for warnings emitted by stable upstream 3D
 * dependencies, not by War Brasil itself.
 *
 * Remove the THREE.Clock branch once React Three Fiber v10 is stable and used.
 * Remove the Rapier branch once @react-three/rapier adopts the object-style
 * wasm-bindgen initialization without requiring Rapier 0.20 breaking changes.
 */
export function installDice3DDependencyWarningFilter() {
  if (typeof window === "undefined") return;

  const globalState = globalThis as WarningFilterGlobal;
  if (globalState[INSTALL_STATE_KEY]) return;
  globalState[INSTALL_STATE_KEY] = true;

  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (args[0] === RAPPIER_WASM_INIT_WARNING) return;
    originalWarn(...args);
  };

  const previousThreeConsole = getConsoleFunction() as ThreeConsoleFunction | null;
  setConsoleFunction((type, message, ...params) => {
    if (type === "warn" && message === THREE_CLOCK_WARNING) return;

    if (previousThreeConsole) {
      previousThreeConsole(type, message, ...params);
      return;
    }

    forwardThreeMessage(type, message, params);
  });
}
