import type { PropOptions } from './types';
import { ref, watch } from './reactivity.js';
import { debounce, getCurrentNode, getPropValue, importCssModule, stylesheetCache } from './internals.js';

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
  const { element, update } = getCurrentNode();
  const current = getPropValue(element, name as keyof Element, options.default);
  const prop = ref(current);

  watch(prop, (value: any) => {
    if (element[name] !== value) {
      element[name] = value;
    }
  });

  Object.defineProperty(element, name, {
    get() {
      return prop.value;
    },
    set(value) {
      prop.value = value;

      for (const fn of update) {
        fn();
      }
    },
  });

  getCurrentNode().props[name] = prop;

  return prop;
}

function defineEvent(name: string) {
  const { element } = getCurrentNode();

  return function emitter(value: any) {
    const event = new CustomEvent(name, { detail: value });
    element.dispatchEvent(event);
    const handler = element['on' + name];
    if (typeof handler === 'function') {
      handler(event);
    }
  };
}

function templateRef(name: string) {
  const dom = getCurrentNode().dom;
  const $ref = ref(dom.querySelector(`[ref="${name}"]`), true);
  getCurrentNode().refs[name] = $ref;
  return $ref;
}

function loadCss(href: string | URL) {
  href = String(href);
  const element = getElement();

  if (!stylesheetCache.has(href)) {
    stylesheetCache.set(href, importCssModule(href));
  }

  const stylesheet = stylesheetCache.get(href);
  stylesheetCache.get(href)?.then((s) => (element.shadowRoot || document).adoptedStyleSheets.push(s));

  return stylesheet;
}

export { getElement, onInit, onUpdate, onDestroy, defineProp, defineEvent, templateRef, loadCss };
export { use } from './rules.js';
export * from './reactivity.js';
export { mount, load } from './component.js';
export { setFeatureFlag } from './feature-flags.js';
export { getInternals } from './component.js';