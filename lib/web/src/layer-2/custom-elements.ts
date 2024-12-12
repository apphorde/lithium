import { mount } from "./mount.js";
import type { AnyFunction, ComponentDefinitions } from "../layer-0/types.js";

const mounted = Symbol();
export const DefineComponent = Symbol("@@def");

export function createComponent(name: string, def: ComponentDefinitions): void {
  if (customElements.get(name)) {
    customElements.get(name)![DefineComponent] = def;
    // TODO propagate updates to all instances
    return;
  }

  class Component extends HTMLElement {
    private __destroy: AnyFunction;

    connectedCallback() {
      if (!this[mounted]) {
        mount(this, Component[DefineComponent]);
        this[mounted] = true;
      }
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

