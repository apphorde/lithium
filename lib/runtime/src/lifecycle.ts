import { tpl, traverseDom, isElement, isFragment, clearElement, mapContentToSlots } from '@li3/dom';
import { CreateRuntimeOptions, RuntimeContext } from './types.js';
import { Plugins } from './plugin.js';
import { createState } from './create-state.js';
import { push, pop } from './stack.js';
import { getOption } from './options.js';

const noop = () => {};
const VM = Symbol('@@Runtime');

export function createRuntimeContext(properties: CreateRuntimeOptions): RuntimeContext {
  const { setup = noop, template, shadowDom } = properties;

  const $el = new RuntimeContext({
    ...properties,
    shadowDom: typeof shadowDom === 'string' ? ({ mode: shadowDom } as ShadowRootInit) : shadowDom,
    setup,
    template: !template ? '' : typeof template === 'string' ? tpl(template) : template,
  });

  return $el;
}

export function activateContext($el: RuntimeContext) {
  push($el);

  try {
    createState($el);
    createDom($el);

    ($el.element as any).__destroy = () => {
      Plugins.apply('destroy', [$el]);
      $el.destroy.forEach((f) => f($el));
    };

    Plugins.apply('init', [$el]);
    $el.init.forEach((f) => f($el));

    if (getOption('debugEnabled')) {
      $el.element[VM] = $el;
    }
  } catch (error) {
    if (getOption('debugEnabled')) {
      throw error;
    }

    console.log('Failed to initialize component!', $el, error);
  }

  pop();
}

export function createDom($el: RuntimeContext): void {
  if (!$el.template) {
    return;
  }

  const { element, template, shadowDom } = $el;
  const dom = template.content.cloneNode(true);

  Plugins.apply('dom', [$el, dom]);

  traverseDom(dom, (node, attributes) => {
    Plugins.apply('element', [$el, node]);

    if (!isElement(node) || !(Array.isArray(attributes) && attributes.length)) {
      return;
    }

    for (const attr of attributes) {
      const attribute = attr[0].trim();
      const value = attr[1].trim();
      Plugins.apply('attribute', [$el, node, attribute, value]);
    }
  });

  const previousContent = Array.from(element.childNodes);

  if (!shadowDom) {
    clearElement(element);
  }

  if (!shadowDom || isFragment(element)) {
    element.append(dom);
    mapContentToSlots(previousContent, element);
  } else {
    (element as Element).attachShadow(shadowDom as ShadowRootInit).append(dom);
  }
}
