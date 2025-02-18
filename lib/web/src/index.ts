import { getOption, setOption } from './internal-api/options.js';

// internal tools
import { createState, fork } from './internal-api/reactive.js';
import { pop, push, getCurrentContext } from './internal-api/stack.js';
import * as dom from './internal-api/dom.js';

export type * from './internal-api/types.js';
export { createDispatcher } from './internal-api/plugin.js';
export { getCurrentContext } from './internal-api/stack.js';
export { tpl, domReady } from './internal-api/dom.js';

// public API
import * as API from './component-api/setup.js';
import { getComponentFromTemplate, loadAndParse } from './component-api/custom-elements.js';

export * from './component-api/setup.js';
export type * from './component-api/custom-elements.js';
import { createComponent, createInlineComponent, createApp, mount } from './component-api/custom-elements.js';
export { createComponent, createInlineComponent, createApp, mount } from './component-api/custom-elements.js';

// plugins
import { createAttributeBinding, createPropertyBinding } from './plugins/property-binding.plugin.js';
import { createEventBinding } from './plugins/event-handler.plugin.js';
import { addScriptToPage, adoptStyleSheet, injectStylesheetOnElement } from './plugins/inject-resources.plugin.js';
import { createClassBinding } from './plugins/set-class.plugin.js';
import { setElementRefValue } from './plugins/set-element-ref.plugin.js';
import { createStyleBinding } from './plugins/set-style.plugin.js';
import { applyHostAttributes } from './plugins/host-properties.plugin.js';
import { templateForOf } from './plugins/template-for.plugin.js';
import { templateIf } from './plugins/template-if.plugin.js';
import { createTextNodeBinding } from './plugins/text-template.plugin.js';
import { plugins } from './internal-api/plugin.js';

// re-export reactive API
import { unref, isRef, valueRef } from '@li3/reactive';
export { type Ref, unref, isRef, debounce, valueRef, computedRef } from '@li3/reactive';

export const Reactive = { createState, fork, isRef, unref, ref: valueRef };
export const DOM = { ...dom };
export const Options = { getOption, setOption };
export const Stack = { pop, push, getCurrentContext };
export const Component = {
  fromTemplate: getComponentFromTemplate,
  load: loadAndParse,
  create: createComponent,
  createInline: createInlineComponent,
  createApp,
  mount,
};
export const Plugins = {
  use: plugins.use,
  reset: plugins.reset,
  addScriptToPage,
  adoptStyleSheet,
  applyHostAttributes,
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

export const Lithium = {
  Reactive,
  DOM,
  Options,
  Component,
  Plugins,
  API: { ...API },
};

window['Lithium'] = Lithium;

if (window.name === 'debug') {
  setOption('debugEnabled', true);
}
