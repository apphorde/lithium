import { getCurrentContext } from '../internal-api/stack.js';
import { EventEmitFunction } from '../internal-api/types.js';
import { defineEventOnElement, isElement, emitEvent } from '../internal-api/dom.js';
import type { AnyFunction } from '../internal-api/types.js';
import { type Ref, computedRef, valueRef } from '@li3/reactive';
import { createInputRef, getPropValue, type PropDefinition } from '../internal-api/props.js';

export function loadCss(url: string): void {
  getCurrentContext().stylesheets.push(url);
}

export function loadScript(url: string): void {
  getCurrentContext().scripts.push(url);
}

export function onInit(fn: VoidFunction): void {
  getCurrentContext().init.push(fn);
}

export function onUpdate(fn: VoidFunction): void {
  getCurrentContext().update.push(fn);
}

export function onDestroy(fn: VoidFunction): void {
  getCurrentContext().destroy.push(fn);
}

export function hostClasses(classes: string) {
  getCurrentContext().hostClasses.push(classes);
}

export function defineQuery(selector: string) {
  const $el = getCurrentContext();
  const root = ($el.element as Element).shadowRoot || $el.element;

  return new Proxy(
    {},
    {
      get(_t, key) {
        if (key === 'one') {
          return root.querySelector(selector);
        }

        if (key === 'many') {
          return root.querySelectorAll(selector);
        }

        return null;
      },
    },
  );
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

export function defineEvent(name: string) {
  const el = getCurrentContext().element;

  if (isElement(el)) {
    defineEventOnElement(el, name);
  }

  return emitEvent.bind(null, el, name);
}

export function defineProps(definitions: string[] | Record<string, PropDefinition<any>>): any {
  const $el = getCurrentContext();
  const propertyNames = !Array.isArray(definitions) ? Object.keys(definitions) : definitions;

  for (const property of propertyNames) {
    defineProp(property, definitions[property]);
  }

  return $el.props;
}

export function defineProp<T>(property: string, definition?: PropDefinition<T>) {
  const $el = getCurrentContext();
  const initialValue = getPropValue($el, property, definition);
  const $ref = createInputRef($el, property, initialValue);
  $el.props[property] = $ref;

  return $ref;
}

export function watch(expression: AnyFunction | Ref<any>, effect?: AnyFunction): void {
  return getCurrentContext().reactive.watch(expression, effect);
}

export function computed<T>(fn: () => T): Ref<T> {
  return computedRef(fn) as Ref<T>;
}

export function ref<T>(value?: T, options?): Ref<T> {
  return valueRef(value, options);
}

export function shallowRef<T>(value?: T): Ref<T> {
  return ref(value, { shallow: true });
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

export function inject<T>(token: any) {
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
