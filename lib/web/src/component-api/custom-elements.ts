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

export function getShadowDomOptions(template: HTMLTemplateElement): ShadowRootInit {
  const source = template.getAttribute('shadow-dom') || '';

  if (source) {
    return source.startsWith("{") ? JSON.parse(source) : { mode: source };
  }
}

export async function getComponentFromTemplate(template: HTMLTemplateElement): Promise<ComponentDefinition> {
  const setup = template.content.querySelector("script[setup]");
  const component: ComponentDefinition = { template, shadowDom: getShadowDomOptions(template) };

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

/**
 * Creates a custom element from a template element
 *
 * @param template The template element to create a component from
 * @param name Optional. Name of the custom element, if not provided it will be taken from the 'component' attribute
 */
export async function createInlineComponent(template: HTMLTemplateElement, name = '') {
  name ||= template.getAttribute("component");

  if (!name) {
    throw new Error('Component name is required');
  }

  const component = await getComponentFromTemplate(template);
  createComponent(name, component);
}

/**
 * Loads a component template from a URL. The source must be a valid HTML template element,
 * with a <script setup> block if the component requires a setup function.
 * <style> tags are also supported as usual.
 *
 * @param url
 * @returns
 */
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

/**
 * Loads a component from a URL and registers it as a custom element
 * @param url
 * @returns {Promise<void>}
 */
export async function loadAndParse(url: string | URL) {
  const t = await loadTemplate(url);
  return createInlineComponent(t);
}