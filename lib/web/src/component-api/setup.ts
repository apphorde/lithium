import { getCurrentInstance } from "../internal-api/stack.js";
import { EventEmitFunction } from "../internal-api/types.js";
import { defineEventOnElement, isElement, emitEvent } from "../internal-api/dom.js";
import type { AnyFunction } from "../internal-api/types.js";
import type { Ref } from "@li3/reactive";
import { getPropValue } from "../internal-api/props.js";
import { plugins } from "../internal-api/plugin.js";

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

export function defineEvents(eventNames: any): EventEmitFunction {
  const el = getCurrentInstance().element;

  if (isElement(el)) {
    for (const event of eventNames) {
      defineEventOnElement(el, event);
    }
  }

  return emitEvent.bind(null, el);
}

export function defineProps(definitions: string[] | Record<string, any>): any {
  const $el = getCurrentInstance();
  const keys = !Array.isArray(definitions) ? Object.keys(definitions) : definitions;
  const { element, state } = $el;
  const props = {};

  for (const property of keys) {
    let initialValue = getPropValue($el, property, definitions[property]);

    const $ref = $el.reactive.ref(initialValue);
    state[property] = $ref;
    props[property] = $ref;

    if (!isElement(element)) {
      continue;
    }

    Object.defineProperty(element, property, {
      get() {
        return $ref.value;
      },
      set(value) {
        const oldValue = $ref.value;
        $ref.value = value;
        plugins.apply("update", [$el, property, oldValue, value]);
        $el.update.forEach((f) => f($el, property, oldValue, value));
      },
    });
  }

  return new Proxy(
    { __w: true },
    {
      get(_t, p) {
        if (p === "__w") return true;

        if (props[p]) {
          return props[p].value;
        }
      },
      set(_t, p, value) {
        if (props[p] && props[p].value !== value) {
          $el.reactive.suspend();
          props[p].value = value;
          $el.reactive.unsuspend();
        }

        return true;
      },
    }
  );
}

export function watch(expression: AnyFunction, effect?: AnyFunction): void {
  return getCurrentInstance().reactive.watch(expression, effect);
}

export function computed<T>(fn: () => T): Ref<T> {
  const $ref = ref<T>(null, { shallow: true });
  watch(() => {
    const v = fn();
    if ($ref.value !== v) {
      $ref.value = v;
    }
  });

  return $ref;
}

export function ref<T>(value?: T, options?): Ref<T> {
  return getCurrentInstance().reactive.ref(value, options);
}

export function shallowRef<T>(value?: T, options = {}): Ref<T> {
  return ref(value, { ...options, shallow: true });
}
