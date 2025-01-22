import { getOption, setOption } from "./internal-api/options.js";

export type * from "./internal-api/types.js";
export { getOption, setOption } from "./internal-api/options.js";
export { createDispatcher, plugins } from "./internal-api/plugin.js";

import { createState, fork } from "./internal-api/reactive.js";
export { getCurrentInstance, pop, push } from "./internal-api/stack.js";
import * as dom from "./internal-api/dom.js";

export { tpl, domReady } from "./internal-api/dom.js";
export * from "./component-api/setup.js";
export { inject, provide } from "./component-api/inject.js";
export { createComponent, createInlineComponent } from "./component-api/custom-elements.js";
export { mount } from "./component-api/mount.js";
export { bootstrap } from "./component-api/bootstrap.js";

import { createAttributeBinding, createPropertyBinding } from "./plugins/property-binding.plugin.js";
import { createEventBinding } from "./plugins/event-handler.plugin.js";
import { addScriptToPage, adoptStyleSheet, injectStylesheetOnElement } from "./plugins/inject-resources.plugin.js";
import { createClassBinding } from "./plugins/set-class.plugin.js";
import { setElementRefValue } from "./plugins/set-element-ref.plugin.js";
import { createStyleBinding } from "./plugins/set-style.plugin.js";
import { templateForOf } from "./plugins/template-for.plugin.js";
import { templateIf } from "./plugins/template-if.plugin.js";
import { createTextNodeBinding } from "./plugins/text-template.plugin.js";
import { plugins } from './internal-api/plugin.js';

import { unref, isRef } from "@li3/reactive";
export { Ref, unref, isRef } from "@li3/reactive";

export const Reactive = { createState, fork, isRef, unref };
export const DOM = { ...dom };
export const Plugins = {
    use: plugins.use,
    addScriptToPage,
    adoptStyleSheet,
    createAttributeBinding,
    createClassBinding,
    createEventBinding,
    createPropertyBinding,
    createStyleBinding,
    createTextNodeBinding,
    injectStylesheetOnElement,
    setElementRefValue,
    templateForOf,
    templateIf,
  };

window["Lithium"] = {
  setOption,
  getOption,
  Reactive,
  DOM,
  Plugins
};

if (window.name === "debug") {
  setOption("debugEnabled", true);
}
