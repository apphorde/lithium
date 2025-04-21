import { defineEventOnElement, emitEvent, isElement } from '@li3/dom';
import { type Signal, signal as $, effect as $$, observer } from '@li3/reactive';
import {
  AnyFunction,
  createInputRef,
  EventEmitFunction,
  getCurrentContext,
  getPropValue,
  type PropDefinition,
} from '@li3/runtime';

export function onInit(fn: VoidFunction): void {
  getCurrentContext().init.push(fn);
}

export function onUpdate(fn: VoidFunction): void {
  getCurrentContext().update.push(fn);
}

export function onDestroy(fn: VoidFunction): void {
  getCurrentContext().destroy.push(fn);
}

export interface QueryObject {
  one: Element | null;
  many: NodeListOf<Element>;
}

export function defineQuery(selector: string): QueryObject {
  const $el = getCurrentContext();
  const root = ($el.element as Element).shadowRoot || $el.element;

  return new Proxy({} as QueryObject, {
    get(_t, key) {
      if (key === 'one') {
        return root.querySelector(selector);
      }

      if (key === 'many') {
        return Array.from(root.querySelectorAll(selector));
      }

      return null;
    },
  });
}

export function defineEvents(eventNames: string[]): EventEmitFunction {
  const el = getCurrentContext().element;

  if (isElement(el)) {
    for (const event of eventNames) {
      defineEventOnElement(el, event);
    }
  }

  return emitEvent.bind(null, el);
}

export function defineEvent(name: string): any {
  const el = getCurrentContext().element;

  if (isElement(el)) {
    defineEventOnElement(el, name);
  }

  return emitEvent.bind(null, el, name);
}

export function defineProps(definitions: string[] | Record<string, PropDefinition<any>>): Record<string, Signal<any>> {
  const $el = getCurrentContext();
  const propertyNames = !Array.isArray(definitions) ? Object.keys(definitions) : definitions;

  for (const property of propertyNames) {
    defineProp(property, definitions[property]);
  }

  return $el.props;
}

export function defineProp<T>(property: string, definition?: PropDefinition<T>): Signal<T> {
  const $el = getCurrentContext();
  const initialValue = getPropValue($el, property, definition);
  const signal = $(initialValue);

  createInputRef<T>($el, property, signal);
  $el.props[property] = signal;

  return signal;
}

export function computed<T>(fn: () => T, effect?: AnyFunction): Signal<T> {
  const signal = $$(fn);

  if (effect) {
    observer(signal, effect);
  }

  return signal;
}

export function ref<T>(value?: T, options?): Signal<T> {
  return $(value, options);
}

export function shallowRef<T>(value?: T): Signal<T> {
  return $(value, { shallow: true });
}

type InjectionEvent<T> = CustomEvent & { result?: T };

export function provide<T>(token: Symbol, provider): void {
  const fn = typeof provider === 'function' ? provider : () => provider;
  const { element } = getCurrentContext();

  element.addEventListener('$inject', (e: InjectionEvent<T>) => {
    if (e.detail === token) {
      e.result = fn();
      e.stopPropagation();
    }
  });
}

export function inject<T>(token: any): T {
  const { element } = getCurrentContext();
  const event = new CustomEvent('$inject', {
    detail: token,
    bubbles: true,
  }) as CustomEvent & { result: T };

  element.dispatchEvent(event);

  const result = event.result;

  if (!result) {
    throw new Error('Injectable not found: ' + token);
  }

  return result;
}
