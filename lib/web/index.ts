import { ReactiveContext } from "@lithium/reactive";
import { createInstance } from "./src/setup.js";
import type { AnyFunction, RuntimeDefinitions } from "./src/types";

export * from "./src/dom.js";
export * from "./src/setup.js";

export const noop = () => {};
export const DefineComponent = Symbol("@@def");

export function createComponent(name: string, def: RuntimeDefinitions): void {
  if (customElements.get(name)) {
    customElements.get(name)![DefineComponent] = def;
    // TODO propagate updates to all instances
    return;
  }

  class Component extends HTMLElement {
    private __destroy: AnyFunction;

    connectedCallback() {
      mount(this, Component[DefineComponent]);
    }

    disconnectedCallback() {
      if (!this.isConnected && this.__destroy) {
        queueMicrotask(this.__destroy);
      }
    }
  }

  Component[DefineComponent] = def;
  customElements.define(name, Component);
}

export function mount(
  element: Element | string,
  def: RuntimeDefinitions,
  props?
) {
  if (typeof element === "string") {
    element = document.querySelector(element);
  }

  const { setup, template, shadowDom } = def;
  const $el = {
    shadowDom,
    element,
    props,
    setup,
    stylesheets: [],
    scripts: [],
    template,
    state: {},
    stateKeys: [],
    stateArgs: [],
    init: null,
    destroy: null,
    reactive: new ReactiveContext(),
  };

  return Promise.resolve($el).then(createInstance);
}
