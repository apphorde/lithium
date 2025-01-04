import { getCurrentInstance } from "../layer-0/stack.js";
import { EventEmitFunction } from "../layer-0/types.js";
import { defineEventOnElement, isElement } from "./dom.js";

export function loadCss(url: string): void {
  getCurrentInstance().stylesheets.push(url);
}

export function loadScript(url: string): void {
  getCurrentInstance().scripts.push(url);
}

export function onInit(fn: VoidFunction): void {
  getCurrentInstance().init.push(fn);
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

export function emitEvent(
  element: Element,
  eventName: string,
  detail: any
): void {
  const event = new CustomEvent(eventName, { detail });
  element.dispatchEvent(event);
}
