import { tpl } from '@li3/dom';
import { activateContext, AnyFunction, ComponentDefinition, createRuntimeContext, RuntimeContext } from '@li3/runtime';
import { getComponentFromTemplate, loadTemplate } from './internal.js';

const DefineComponent = Symbol('@@def');

/**
 * Create a custom element from a component definition
 * @param name The name of the custom element. Must follow the custom element naming rules
 * @param def The component definition. Can be a setup function or an object with a setup function and other options
 */
export function createComponent(name: string, def: ComponentDefinition | AnyFunction): void {
  if (typeof def === 'function') {
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

/**
 * Creates a custom element from a template element
 *
 * @param template The template element to create a component from
 * @param name Optional. Name of the custom element, if not provided it will be taken from the 'component' attribute
 */
export async function createComponentFromTemplate(template: HTMLTemplateElement | string, name = '') {
  if (typeof template === 'string') {
    template = tpl(template);
  }

  name ||= template.getAttribute('component');

  if (!name) {
    throw new Error('Component name is required');
  }

  const component = await getComponentFromTemplate(template);
  createComponent(name, component);
}

/**
 * Loads a component from a URL and registers it as a custom element
 */
export async function loadAndParse(url: string | URL): Promise<void> {
  const t = await loadTemplate(url);
  return createComponentFromTemplate(t);
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
  if (typeof element === 'string') {
    element = document.querySelector(element);
  }

  if (!element) {
    throw new Error('Target element not found');
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

export async function createApp(template: HTMLTemplateElement, spec: ComponentDefinition) {
  const div = document.createElement('div');
  div.style.display = 'contents';
  template.parentNode.insertBefore(div, template);

  return mount(div, spec);
}
