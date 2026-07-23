import type { PropOptions } from './types';
import { ref } from './reactivity.js';
import { debounce, getCurrentNode, definePropInternal, eventEmitter } from './internals.js';

function getElement() {
  return getCurrentNode().element;
}

function onInit(fn: any) {
  getCurrentNode().mount.push(fn);
}

function onUpdate(fn: any) {
  getCurrentNode().update.push(debounce(fn));
}

function onDestroy(fn: any) {
  getCurrentNode().unmount.push(fn);
}

function defineProp(name: string, options: PropOptions = {}) {
  return definePropInternal(name, options);
}

function defineEvent(name: string) {
  const { element } = getCurrentNode();
  return eventEmitter.bind(null, element, name);
}

function templateRef(name: string) {
  const dom = getCurrentNode().dom;
  const $ref = ref(dom.querySelector(`[ref="${name}"]`), true);
  getCurrentNode().refs[name] = $ref;
  return $ref;
}

export { getElement, onInit, onUpdate, onDestroy, defineProp, defineEvent, templateRef };
export {
  use,
  SetAttribute,
  SetClassName,
  SetProperty,
  SetStyle,
  AddEventListener,
  TemplateFor,
  TemplateIf,
  type Rule,
} from './rules.js';
export * from './reactivity.js';
export { mount, load, loadCss, autoInitialize } from './component.js';
export { setFeatureFlag } from './feature-flags.js';
export { getInternals } from './component.js';
