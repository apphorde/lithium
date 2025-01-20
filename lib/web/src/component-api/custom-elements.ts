import { mount } from "./mount.js";
import type { AnyFunction, ComponentDefinition } from "../internal-api/types.js";

export const DefineComponent = Symbol("@@def");

export function createComponent(name: string, def: ComponentDefinition | AnyFunction): void {
  if (typeof def === "function") {
    def = { setup: def } as ComponentDefinition;
  }

  if (customElements.get(name)) {
    customElements.get(name)![DefineComponent] = def;
    // TODO propagate updates to all instances?
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
