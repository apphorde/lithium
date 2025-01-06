import { getOption, setOption } from "./internal-api/options.js";

export * from "./internal-api/types.js";
export * from "./internal-api/options.js";
export * from "./internal-api/plugin.js";
export * from "./internal-api/reactive.js";
export * from "./internal-api/stack.js";

export * from "./internal-api/dom.js";
export * from "./component-api/setup.js";
export * from "./component-api/inject.js";

export * from "./component-api/custom-elements.js";
export * from "./component-api/mount.js";
export * from "./component-api/bootstrap.js";

export * from "./plugins/property-binding.plugin.js";
export * from "./plugins/event-handler.plugin.js";
export * from "./plugins/inject-resources.plugin.js";
export * from "./plugins/set-class.plugin.js";
export * from "./plugins/set-element-ref.plugin.js";
export * from "./plugins/set-style.plugin.js";
export * from "./plugins/template-for.plugin.js";
export * from "./plugins/template-if.plugin.js";
export * from "./plugins/text-template.plugin.js";

window["Lithium"] = {
  setOption,
  getOption,
};

if (window.name === "debug") {
  setOption("debugEnabled", true);
}
