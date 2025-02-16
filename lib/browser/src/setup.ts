import { defineEventOnElement, emitEvent, isElement } from '@li3/dom';
import type { Ref } from '@li3/reactive';
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

export function computed<T>(fn: () => T) {
  const $ref = ref<T>(null, { shallow: true });
  watch(() => ($ref.value = fn()));

  return $ref;
}

export function ref<T>(value?: T, options?) {
  return getCurrentContext().reactive.ref<T>(value, options);
}

export function shallowRef<T>(value?: T, options = {}) {
  return ref<T>(value, { ...options, shallow: true });
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
