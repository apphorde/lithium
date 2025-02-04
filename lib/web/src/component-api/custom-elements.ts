import { activateContext, createRuntimeContext } from "../internal-api/lifecycle.js";
import { domReady } from "../internal-api/dom.js";

import type { AnyFunction, ComponentDefinition, RuntimeContext } from "../internal-api/types.js";
import { createBlobModule } from "../internal-api/expressions";

export const DefineComponent = Symbol("@@def");

/**
 * Create a custom element from a component definition
 * @param name The name of the custom element. Must follow the custom element naming rules
 * @param def The component definition. Can be a setup function or an object with a setup function and other options
 */
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
    const dom = new DOMParser().parseFromString(html, 'text/html');
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

const mounted = Symbol();

export interface MountOptions {
  props?: any;
  parent?: RuntimeContext;
}

/**
 * Mount a component to a target element
 * @param element The target element to mount the component to
 * @param def The component definition
 * @param options Optional. Props to pass to the component or a parent context to inherit from
 */
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

  const $el = createRuntimeContext({
    element,
    setup,
    template,
    shadowDom,
    initialValues: options?.props,
    parent: options?.parent,
  });

  activateContext($el);

  return $el;
}

export async function createApp(template: HTMLTemplateElement, spec) {
  const div = document.createElement("div");
  div.style.display = "contents";
  template.parentNode.insertBefore(div, template);

  return mount(div, spec);
}

domReady(function () {
  const inline: HTMLTemplateElement[] = Array.from(document.querySelectorAll("template[component]"));
  const apps: HTMLTemplateElement[] = Array.from(document.querySelectorAll("template[app]"));

  for (const template of inline) {
    createInlineComponent(template);
  }

  for (const template of apps) {
    getComponentFromTemplate(template).then((spec) => createApp(template, spec));
  }
});
