import { mount } from "./mount.js";
import type {
  AnyFunction,
  ComponentDefinition,
} from "../internal-api/types.js";
import { createBlobModule } from "../internal-api/expressions";

export const DefineComponent = Symbol("@@def");

export function createComponent(
  name: string,
  def: ComponentDefinition | AnyFunction
): void {
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

export async function getComponentFromTemplate(template: HTMLTemplateElement): Promise<ComponentDefinition> {
  const setup = template.content.querySelector("script[setup]");
  const component: ComponentDefinition = { template };

  if (setup) {
    const href = setup.getAttribute("src");
    const md = href
      ? await import(new URL(href, window.location.href).toString())
      : await createBlobModule(setup.textContent.trim(), "text/javascript");

    setup.remove();
    component.setup = md.default;
  }

  return component;
}

export async function createInlineComponent(template: HTMLTemplateElement, name = '') {
  name ||= template.getAttribute("component");

  if (!name) return;

  const component = await getComponentFromTemplate(template);
  createComponent(name, component);
}
