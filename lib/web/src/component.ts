import { FF } from './feature-flags.js';
import { createContext, createReadOnlyContext, importCssModule, importModuleFromSource } from './internals.js';
import { linkTreeToContext, linkTreeToContextAsync } from './rules.js';
import type { DefineComponentOptions, MountOptions } from './types';

const DEBUG = Symbol('#');

export function getInternals(t: any) {
  return t[DEBUG];
}

function getOrigin(template: HTMLTemplateElement) {
  let url =  template.getAttribute('origin');

  if (!url) {
    const origin = new URL(window.location.href);
    const c = template.getAttribute('component');

    if (c) {
      origin.pathname += '/' + template.getAttribute('component') + '.html';
      url = String(origin);
      template.setAttribute('origin', url);
    } else {
      url = origin.pathname;
    }
  }

  return url;
}

function getShadowDomOptions(template: HTMLTemplateElement): ShadowRootInit | undefined {
  const source = template.getAttribute('shadow-dom') || '';

  if (source) {
    return source.startsWith('{') ? JSON.parse(source) : { mode: source as ShadowRootMode };
  }
}

const loadCache = new Map();

export async function load(href: string | URL, baseUrl?: string | URL) {
  const origin = String(baseUrl || window.location.href);
  const fullUrl = String(new URL(href, origin));

  if (loadCache.has(fullUrl)) {
    return loadCache.get(fullUrl);
  }

  try {
    const response = await fetch(fullUrl);

    if (!response.ok) {
      throw new Error('Failed to load components from ' + href);
    }

    const html = await response.text();
    const dom = new DOMParser().parseFromString(html, 'text/html');
    const templates = Array.from(dom.querySelectorAll('template[component]')) as HTMLTemplateElement[];
    templates.forEach(t => t.setAttribute('origin', fullUrl));
    const definitions = templates.map(n => defineFromTemplate(n)).filter(Boolean);


    const def = await Promise.all(definitions) as DefineComponentOptions[];
    loadCache.set(fullUrl, def);
    return def;
  } catch (error) {
    console.error('Error loading component from', href, error);
    return [];
  }
}

//
const invalidNames = [
  "annotation-xml",
  "color-profile",
  "font-face",
  "font-face-src",
  "font-face-uri",
  "font-face-format",
  "font-face-name",
  "missing-glyph",
]

export function defineComponent(name: string, options: MountOptions) {
  if (invalidNames.includes(name) ) {
    throw new Error('Invalid element name. See https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name');
  }

  if (customElements.get(name)) {
    console.error(`Component ${name} is already defined!`);
    return;
  }

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
  const origin = getOrigin(template);

  if (setupCode) {
    const src = setupCode.getAttribute('src');
    const code = setupCode.textContent;
    const mod = src ? import(String(new URL(src, origin))) : importModuleFromSource(code, origin);
    setupCode.remove();

    return (await mod).default;
  }

  return Function;
}

async function findStyleSheets(template: HTMLTemplateElement): Promise<CSSStyleSheet[]> {
  const styleTags = Array.from(template.content.querySelectorAll('style')) as HTMLStyleElement[];
  const linkTags = Array.from(template.content.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];

  if (!(styleTags.length || linkTags.length)) {
    return [];
  }

  const styles = styleTags.map((tag) => {
    let sheet = tag.sheet;

    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(tag.textContent.trim());
    }

    tag.remove();
    return sheet;
  });

  const origin = getOrigin(template);
  const links = linkTags.map(link => {
    const href = String(new URL(link.href, origin));
    const sheet = importCssModule(href);
    link.remove();
    return sheet;
  })

  return (await Promise.all(links)).concat(styles);
}

export function loadDependencies(template: HTMLTemplateElement) {
  const links = Array.from(template.content.querySelectorAll('link[rel=component]')) as HTMLLinkElement[];
  const origin = getOrigin(template);

  for (const link of links) {
    load(link.href, origin);
    link.remove();
  }
}

export function tpl(s: string) {
  const template = document.createElement('template');
  template.innerHTML = String(s).trim();

  return template;
}

export async function readOptionsFromTemplate(template: HTMLTemplateElement) {
  loadDependencies(template);

  const options: MountOptions = {
    template,
    setup: await findSetupModule(template),
    styles: await findStyleSheets(template),
  };

  return options;
}

export async function defineFromTemplate(template: HTMLTemplateElement | string): Promise<DefineComponentOptions|null> {
  if (typeof template === 'string') {
    template = tpl(template);
  }

  const name = template.getAttribute('component') as string;

  if (!name) {
    return null;
  }

  const options = await readOptionsFromTemplate(template);
  defineComponent(name, options);

  return { name, ...options };
}

export async function findApps() {
  const apps = Array.from(document.querySelectorAll('template[app]')) as HTMLTemplateElement[];

  for (const template of apps) {
    readOptionsFromTemplate(template).then(options => {
      const app = document.createElement('div');
      app.style.display = 'contents';
      template.parentNode!.insertBefore(app, template);

      mount(app, options);
      FF.debug || template.remove();
    })
    .catch(error => console.error(error));
  }
}

export function autoInitialize() {
  const components = Array.from(document.querySelectorAll('template[component]')) as HTMLTemplateElement[];
  const links = Array.from(document.querySelectorAll('link[rel="component"]')) as HTMLLinkElement[];

  components.forEach(c => defineFromTemplate(c));
  links.forEach((l) => load(l.href));

  findApps();
}

if (!FF.skipAutoInitialize) {
  if (['complete', 'interactive'].includes(document.readyState)) {
    autoInitialize();
  } else {
    window.addEventListener('DOMContentLoaded', autoInitialize);
  }
}
