import { getOption, setOption } from "./internal-api/options.js";

export type * from "./internal-api/types.js";
export { getOption, setOption } from "./internal-api/options.js";
export { PluginDispatcher, plugins } from "./internal-api/plugin.js";

import * as reactive from "./internal-api/reactive.js";
import * as stack from "./internal-api/stack.js";
import * as dom from "./internal-api/dom.js";

export { html, tpl, domReady } from "./internal-api/dom.js";
export * from "./component-api/setup.js";
export { inject, provide } from "./component-api/inject.js";
export { createComponent } from "./component-api/custom-elements.js";
export { mount } from "./component-api/mount.js";
export { bootstrap } from "./component-api/bootstrap.js";

import * as plugin1 from "./plugins/property-binding.plugin.js";
import * as plugin2 from "./plugins/event-handler.plugin.js";
import * as plugin3 from "./plugins/inject-resources.plugin.js";
import * as plugin4 from "./plugins/set-class.plugin.js";
import * as plugin5 from "./plugins/set-element-ref.plugin.js";
import * as plugin6 from "./plugins/set-style.plugin.js";
import * as plugin7 from "./plugins/template-for.plugin.js";
import * as plugin8 from "./plugins/template-if.plugin.js";
import * as plugin9 from "./plugins/text-template.plugin.js";

export { Ref, unref, isRef } from "@li3/reactive";

export const Lithium = {
  reactive,
  stack,
  dom,
  ...plugin1,
  ...plugin2,
  ...plugin3,
  ...plugin4,
  ...plugin5,
  ...plugin6,
  ...plugin7,
  ...plugin8,
  ...plugin9,
};

window["Lithium"] = {
  setOption,
  getOption,
};

if (window.name === "debug") {
  setOption("debugEnabled", true);
}
