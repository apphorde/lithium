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

export function getShadowDomValue(source: string): ShadowRootInit {
  if (!source) return;

  source = String(source);

  return source.startsWith("{") ? JSON.parse(source) : { mode: source };
}

export async function getComponentFromTemplate(template: HTMLTemplateElement): Promise<ComponentDefinition> {
  const setup = template.content.querySelector("script[setup]");
  const shadowDom = template.getAttribute('shadow-dom');
  const component: ComponentDefinition = { template, shadowDom: getShadowDomValue(shadowDom) };

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

export async function loadTemplate(url: string | URL) {
  const req = await fetch(url);

  if (req.ok) {
    const html = await req.text();
    const dom = new DOMParser().parseFromString(html, 'text/html').body;
    const template = dom.querySelector('template');
    return template;
  }

  throw new Error('Unable to load ' + url + ': ' + req.statusText);
}

export async function loadAndParse(url: string | URL) {
  const t = await loadTemplate(url);
  return createInlineComponent(t);
}