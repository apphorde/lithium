import type { ComponentDefinition } from "../internal-api/types.js";
import { createInstance } from "../internal-api/lifecycle.js";

const mounted = Symbol();

export interface MountOptions {
  props?: any;
  parent?: any;
}

export function mount(element: DocumentFragment | Element | string, def: ComponentDefinition, options?: MountOptions) {
  if (typeof element === "string") {
    element = document.querySelector(element);
  }

  if (!element) {
    throw new Error("Target element not found");
  }

  // custom element was moved betwen parents and does not need to mount again
  if (element[mounted]) {
    return;
  }

  element[mounted] = true;
  const { setup, template, shadowDom } = def;

  return createInstance({
    element,
    setup,
    template,
    shadowDom,
    initialValues: options?.props,
    parent: options?.parent,
  });
}
