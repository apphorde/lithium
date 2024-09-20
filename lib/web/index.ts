import { ReactiveContext, Ref, unref, isRef } from "@lithium/reactive";
import { Runtime } from "./runtime.js";
import type { RuntimeDefinitions } from "./types";

export * from "./runtime.js";
export * from "./dom.js";
export * from "./setup.js";

type AnyFunction = (...args: any) => any;

const eventFlags = ["capture", "once", "passive", "stop", "prevent"];
const validAttribute = /^[a-zA-Z_][a-zA-Z0-9\-_:.]*$/;
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const domParser = new DOMParser();

export const noop = () => {};
export const DefineComponent = Symbol("@@def");

export function createComponent(name: string, def: RuntimeDefinitions): void {
  if (customElements.get(name)) {
    customElements.get(name)![DefineComponent] = def;
    // TODO propagate updates to all instances
    return;
  }

  class Component extends HTMLElement {
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
