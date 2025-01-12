import type { ComponentDefinitions } from "../internal-api/types.js";
import { createInstance } from "../internal-api/lifecycle.js";

export const noop = () => {};
const mounted = Symbol();

export interface MountOptions {
  props?: any;
  parent?: any;
}

export function mount(element: DocumentFragment | Element | string, def: ComponentDefinitions, options?: MountOptions) {
  if (typeof element === "string") {
    element = document.querySelector(element);
  }

  if (!element) {
    throw new Error("Target element not found");
  }

  if (element[mounted]) {
    console.warn("Tried to mount an element twice", element);
    return;
  }

  element[mounted] = true;
  const { setup = noop, template, shadowDom } = def;

  return createInstance({
    element,
    setup,
    template,
    shadowDom,
    props: options?.props,
    parent: options?.parent,
  });
}
