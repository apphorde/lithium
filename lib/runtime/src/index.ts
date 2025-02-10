import * as Options from "./runtime/options.js";
import * as State from "./runtime/reactive.js";
import * as Stack from "./runtime/stack.js";

export * from "./runtime/lifecycle.js";
export * from "./runtime/options.js";
export * from "./runtime/plugin.js";
export * from "./runtime/props.js";
export * from "./runtime/reactive.js";
export * from "./runtime/stack.js";
export * from "./runtime/types.js";

globalThis["Lithium"] = {
  Options: { ...Options },
  State: { ...State },
  Stack: { ...Stack },
};
