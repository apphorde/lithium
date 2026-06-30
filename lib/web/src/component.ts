import { FF } from './feature-flags.js';
import { createContext, createReadOnlyContext, importModuleFromSource } from './internals.js';
import { linkTreeToContext, linkTreeToContextAsync } from './rules.js';
import type { DefineComponentOptions, MountOptions } from './types';

const DEBUG = Symbol('#');

export function getInternals(t: any) {
  return t[DEBUG];
}

function getShadowDomOptions(template: HTMLTemplateElement): ShadowRootInit | undefined {
  const source = template.getAttribute('shadow-dom') || '';

  if (source) {
    return source.startsWith('{') ? JSON.parse(source) : { mode: source as ShadowRootMode };
  }
}

export async function load(href: string | URL) {
  try {
    const response = await fetch(new URL(href, window.location.href));

    if (!response.ok) {
      throw new Error('Failed to load components from ' + href);
    }

    const html = await response.text();
    const all = await Promise.all(defineFromString(html));
    return all.filter(Boolean) as DefineComponentOptions[];
  } catch (error) {
    console.error('Error loading component from', href, error);
    return [];
  }
}

export function defineComponent(options: DefineComponentOptions) {
  const { name } = options;
  options.template = typeof options.template === 'string' ? tpl(options.template) : options.template;
  const shadowDom: ShadowRootInit | undefined =
    options.shadowDom === true ? { mode: 'open' } : getShadowDomOptions(options.template);

  options.shadowDom = shadowDom;

  class Component extends HTMLElement {
    unmount: Function | null = null;

    constructor() {
      super();

      if (shadowDom) {
        this.attachShadow(shadowDom);
      }
    }

    connectedCallback() {
      if (this.isConnected) {
        this.unmount = mount(this, options);
      } else {
        this.unmount?.();
      }
    }

    disconnectedCallback() {
      if (!this.isConnected) {
        this.unmount?.();
      }
    }
  }

  customElements.define(name, Component);
}

export function mount(target: Element, options: MountOptions) {
  const parentElement = target.shadowRoot || target;
  const { template, setup = Function } = options;

  if (FF.linker && !(template as any).linker) {
    (template as any).linker = linkTreeToContextAsync(template.content);
  }

  const dom = document.createDocumentFragment();
  dom.append(template.content.cloneNode(true));

  const runtime = createContext(target, setup, dom);
  const mergedContext = Object.assign({}, runtime.context, runtime.props, runtime.refs);
  const readOnlyContext = createReadOnlyContext(mergedContext);

  if (FF.linker) {
    (template as any).linker(dom, readOnlyContext);
  } else {
    linkTreeToContext(dom, readOnlyContext);
  }

  parentElement.innerHTML = '';
  parentElement.appendChild(dom);

  if (options.styles?.length) {
    (target.shadowRoot || document).adoptedStyleSheets.push(...options.styles);
  }

  for (const fn of runtime.mount) {
    fn();
  }

  if (FF.debug) {
    (parentElement as any)[DEBUG] = { options, context: readOnlyContext };
  }

  const unmountHooks = runtime.unmount;
  return function () {
    for (const fn of unmountHooks) {
      fn();
    }
  };
}

async function findSetupModule(template: HTMLTemplateElement) {
  const setupCode = template.content.querySelector('script[setup]');

  if (setupCode) {
    const url = setupCode.getAttribute('src');
    const code = setupCode.textContent;
    const mod = url ? import(new URL(url, window.location.href).toString()) : importModuleFromSource(code);
    setupCode.remove();

    return (await mod).default;
  }

  return Function;
}

function findStyleSheets(template: HTMLTemplateElement): CSSStyleSheet[] {
  const styleTags = Array.from(template.content.querySelectorAll('style')) as HTMLStyleElement[];

  if (!styleTags.length) {
    return [];
  }

  return styleTags.map((tag) => {
    let sheet = tag.sheet;

    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(tag.textContent.trim());
    }

    tag.remove();
    return sheet;
  });
}

function loadDependencies(template: HTMLTemplateElement) {
  const links = Array.from(template.content.querySelectorAll('link[rel=component]')) as HTMLLinkElement[];

  for (const link of links) {
    load(link.href);
    link.remove();
  }
}

function tpl(s: string) {
  const template = document.createElement('template');
  template.innerHTML = String(s).trim();

  return template;
}

export async function defineFromTemplate(template: HTMLTemplateElement | string): Promise<DefineComponentOptions|null> {
  if (typeof template === 'string') {
    template = tpl(template);
  }

  const name = template.getAttribute('component') as string;

  if (!name) {
    return null;
  }

  const options: DefineComponentOptions = {
    name,
    template,
    setup: await findSetupModule(template),
    styles: findStyleSheets(template),
  };

  loadDependencies(template);
  defineComponent(options);

  return options;
}

export function defineFromString(html: string) {
  const dom = new DOMParser().parseFromString(html, 'text/html');
  const nodes = Array.from(dom.querySelectorAll('template[component]')) as HTMLTemplateElement[];

  return nodes.map(defineFromTemplate).filter(Boolean);
}

export async function findApps() {
  const apps = Array.from(document.querySelectorAll('template[app]')) as HTMLTemplateElement[];

  for (const template of apps) {
    const options: MountOptions = {
      template,
      setup: await findSetupModule(template),
    };

    const app = document.createElement('div');
    app.style.display = 'contents';
    template.parentNode!.insertBefore(app, template);

    mount(app, options);
    FF.debug || template.remove();
  }
}

function autoInitialize() {
  const components = Array.from(document.querySelectorAll('template[component]')) as HTMLTemplateElement[];

  const links = Array.from(document.querySelectorAll('link[rel="component"]')) as HTMLLinkElement[];

  components.forEach(defineFromTemplate);
  links.forEach((l) => load(l.href));

  findApps();
}

if (document.readyState === 'complete') {
  autoInitialize();
} else {
  window.addEventListener('DOMContentLoaded', autoInitialize);
}
