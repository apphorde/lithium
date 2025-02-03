import { getCurrentInstance } from "../internal-api/stack.js";
import { EventEmitFunction } from "../internal-api/types.js";
import { defineEventOnElement, isElement, emitEvent } from "../internal-api/dom.js";
import type { AnyFunction, RuntimeInternals } from "../internal-api/types.js";
import type { Ref } from "@li3/reactive";
import { createInputRef, getPropValue, type PropDefinition } from "../internal-api/props.js";

export function loadCss(url: string): void {
  getCurrentInstance().stylesheets.push(url);
}

export function loadScript(url: string): void {
  getCurrentInstance().scripts.push(url);
}

export function onInit(fn: VoidFunction): void {
  getCurrentInstance().init.push(fn);
}

export function onUpdate(fn: VoidFunction): void {
  getCurrentInstance().update.push(fn);
}

export function onDestroy(fn: VoidFunction): void {
  getCurrentInstance().destroy.push(fn);
}

export function defineQuery(selector: string) {
  const $el = getCurrentInstance();
  const root = ($el.element as Element).shadowRoot || $el.element;

  return new Proxy(
    {},
    {
      get(_t, key) {
        if (key === "one") {
          return root.querySelector(selector);
        }

        if (key === "many") {
          return root.querySelectorAll(selector);
        }

        return null;
      },
    }
  );
}

export function defineEvents(eventNames: string[]): EventEmitFunction {
  const el = getCurrentInstance().element;

  if (isElement(el)) {
    for (const event of eventNames) {
      defineEventOnElement(el, event);
    }
  }

  return emitEvent.bind(null, el);
}

export function defineEvent(name: string) {
  const el = getCurrentInstance().element;

  if (isElement(el)) {
    defineEventOnElement(el, name);
  }

  return emitEvent.bind(null, el, name);
}

export function defineProps(definitions: string[] | Record<string, PropDefinition<any>>): any {
  const $el = getCurrentInstance();
  const propertyNames = !Array.isArray(definitions) ? Object.keys(definitions) : definitions;
  const props = $el.props;

  for (const property of propertyNames) {
    const initialValue = getPropValue($el, property, definitions[property]);
    props[property] = createInputRef($el, property, initialValue);
  }

  return props;
}

export function defineProp<T>(property: string, definition?: PropDefinition<T>) {
  const $el = getCurrentInstance();
  const initialValue = getPropValue($el, property, definition);
  $el.props[property] = createInputRef($el, property, initialValue);
}

export function syncProp($el: RuntimeInternals, p: string, value: any) {
  if ($el.props[p] && $el.props[p].value !== value) {
    $el.reactive.suspend();
    $el.props[p].value = value;
    $el.reactive.unsuspend();
  }
}

export function watch(expression: AnyFunction, effect?: AnyFunction): void {
  return getCurrentInstance().reactive.watch(expression, effect);
}

export function computed<T>(fn: () => T): Ref<T> {
  const $ref = ref<T>(null, { shallow: true });

  watch(() => {
    $ref.value = fn();
  });

  return $ref;
}

export function ref<T>(value?: T, options?): Ref<T> {
  return getCurrentInstance().reactive.ref(value, options);
}

export function shallowRef<T>(value?: T, options = {}): Ref<T> {
  return ref(value, { ...options, shallow: true });
}


type InjectionEvent<T> = CustomEvent & { result?: T };

export function provide<T>(token: Symbol, provider): void {
  const fn = typeof provider === "function" ? provider : () => provider;
  const { element } = getCurrentInstance();

  element.addEventListener("$inject", (e: InjectionEvent<T>) => {
    if (e.detail === token) {
      e.result = fn();
      e.stopPropagation();
    }
  });
}

export function inject<T>(token: any) {
  const { element } = getCurrentInstance();
  const event = new CustomEvent("$inject", {
    detail: token,
    bubbles: true,
  }) as CustomEvent & { result: T };

  element.dispatchEvent(event);

  const result = event.result;

  if (!result) {
    throw new Error("Injectable not found: " + token);
  }

  return result;
}
