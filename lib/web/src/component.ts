import { FF } from "./feature-flags.js";
import {
  createReadOnlyContext,
  eventEmitter,
  importCssModule,
  importModuleFromSource,
  isValidAttribute,
} from "./internals.js";
import { disposeScope, isWritableRef, ref, runInScope, watch } from "./reactivity.js";
import { linkTreeToContext, prepareCodePlan } from "./rules.js";
import type { DefineComponentOptions, MountOptions, PropOptions, RuntimeContext } from "./types";

const DEBUG = Symbol("#");

export type MountDisposer = (() => void) & { ready: Promise<void> };

const pendingCodePlanMounts = new Set<Promise<void>>();

function trackCodePlanMount(promise: Promise<void>) {
  let tracked: Promise<void>;
  tracked = promise.finally(() => pendingCodePlanMounts.delete(tracked));
  pendingCodePlanMounts.add(tracked);
  return tracked;
}

async function waitForCodePlanMounts() {
  while (pendingCodePlanMounts.size) {
    await Promise.all([...pendingCodePlanMounts]);
  }
}

// adoptedStyleSheets is not implemented by jsdom / SSR virtual DOMs; guard it.
function adoptStyleSheet(root: any, sheet: CSSStyleSheet) {
  root.adoptedStyleSheets?.push?.(sheet);
}

function getOrigin(template: HTMLTemplateElement) {
  let url = template.getAttribute("origin");

  if (!url) {
    url = window.location.href;

    if (template.getAttribute("component")) {
      // add origin to template to correctly load any relative imports within the template's source
      const origin = new URL(url);
      origin.pathname += "/" + template.getAttribute("component") + ".html";
      template.setAttribute("origin", url);
    }
  }

  return url;
}

function getShadowDomOptions(template: HTMLTemplateElement): ShadowRootInit | undefined {
  const source = template.getAttribute("shadow-dom") || "";

  if (source) {
    return source.startsWith("{") ? JSON.parse(source) : { mode: source as ShadowRootMode };
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
      throw new Error("Failed to load components from " + href);
    }

    const html = await response.text();
    const dom = new DOMParser().parseFromString(html, "text/html");
    const templates = Array.from(dom.querySelectorAll("template[component]")) as HTMLTemplateElement[];
    templates.forEach((t) => t.setAttribute("origin", fullUrl));
    const definitions = templates.map((n) => defineFromTemplate(n)).filter(Boolean);
    const def = (await Promise.all(definitions)) as DefineComponentOptions[];
    loadCache.set(fullUrl, def);
    return def;
  } catch (error) {
    console.error("Error loading component from", href, error);
    return [];
  }
}

export function loadCss(href: string | URL, options?: { adopt: boolean }) {
  const stylesheet = importCssModule(String(href));

  if (options?.adopt !== false) {
    const { element } = getCurrentNode();
    stylesheet.then((s) => adoptStyleSheet(element.shadowRoot || document, s));
  }

  return stylesheet;
}

const invalidNames = [
  "annotation-xml",
  "color-profile",
  "font-face",
  "font-face-src",
  "font-face-uri",
  "font-face-format",
  "font-face-name",
  "missing-glyph",
];

export function defineComponent(name: string, options: MountOptions) {
  if (invalidNames.includes(name)) {
    throw new Error(
      "Invalid element name. See https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name",
    );
  }

  const registered: any = customElements.get(name);
  if (registered) {
    if (FF.debug) {
      console.error(`Component ${name} is already defined. Options only apply to new instances of ${name}`);
    }

    registered.options = options;
    return;
  }

  options.template = typeof options.template === "string" ? tpl(options.template) : options.template;
  const shadowDom: ShadowRootInit | undefined =
    options.shadowDom === true ? { mode: "open" } : getShadowDomOptions(options.template);

  options.shadowDom = shadowDom;

  class Component extends HTMLElement {
    static options = options;
    unmount: Function | null = null;

    constructor() {
      super();

      if (shadowDom) {
        this.attachShadow(shadowDom);
      }
    }

    async connectedCallback() {
      if (this.isConnected) {
        this.unmount = mount(this, Component.options);
        await (this.unmount as MountDisposer).ready;
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

export function mount(target: Element, options: MountOptions): MountDisposer {
  const parentElement = target.shadowRoot || target;
  const { template, setup = Function } = options;

  const dom = document.createDocumentFragment();
  dom.append(template.content.cloneNode(true));

  const runtime = createContext(target, setup, dom);

  if (options.refs) {
    for (const [name, value, setter] of options.refs) {
      const $ = ref(guessValue(value));
      runtime.context[name] = $;

      if (setter) {
        runtime.context[setter] = (v: any) => ($.value = v);
      }
    }
  }

  runtime.context.$$emit = eventEmitter.bind(null, target);
  const mergedContext = Object.assign({}, runtime.context, runtime.props, runtime.refs);
  const readOnlyContext = createReadOnlyContext(mergedContext);

  const unmountHooks = runtime.unmount;
  let unmounted = false;
  const unmount = (() => {
    if (unmounted) return;
    unmounted = true;
    for (const fn of unmountHooks) {
      fn();
    }
    disposeScope(runtime.cleanup);
  }) as MountDisposer;

  const commit = () => {
    if (unmounted) return;
    parentElement.innerHTML = "";
    parentElement.appendChild(dom);

    if (options.styles?.length) {
      for (const sheet of options.styles) {
        adoptStyleSheet(target.shadowRoot || document, sheet);
      }
    }

    for (const fn of runtime.mount) {
      fn();
    }

    (parentElement as any)[DEBUG] = mergedContext;
  };

  if (FF.codePlan) {
    unmount.ready = trackCodePlanMount(
      prepareCodePlan(template, readOnlyContext)
        .then((plan) => {
          if (unmounted) return;
          runInScope(runtime.cleanup, () => plan(dom, readOnlyContext));
          commit();
        })
        .catch((error) => {
          if (!unmounted) console.error(error);
          unmount();
        }),
    );
  } else {
    runInScope(runtime.cleanup, () => linkTreeToContext(dom, readOnlyContext));
    commit();
    unmount.ready = Promise.resolve();
  }

  return unmount;
}

const runtimeStack: RuntimeContext[] = [];

export function getCurrentNode() {
  const t = runtimeStack.at(-1);

  if (!t) {
    throw new Error("Missing context for this component");
  }

  return t;
}

function createContext(element: Element, setup: any, dom: DocumentFragment) {
  const runtime: RuntimeContext = {
    dom,
    context: null,
    element,
    mount: [],
    update: [],
    unmount: [],
    props: {},
    refs: {},
    cleanup: new Set(),
  };

  runtimeStack.push(runtime);

  try {
    runtime.context = runInScope(runtime.cleanup, setup);
  } catch (e) {
    console.error(e);
  } finally {
    runtime.context ||= {};
    runtimeStack.pop();
  }

  return runtime;
}

function guessValue(s: string) {
  s = String(s).trim();

  if (s === "true") {
    return true;
  }

  if (s === "false") {
    return false;
  }

  try {
    return Function("return " + s)();
  } catch {
    return s;
  }
}

function getPropValue<T extends keyof Element>(element: Element, name: T, options: PropOptions = {}) {
  const defaultValue = typeof options.default === "function" ? options.default() : options.default;
  const value = element[name];

  if (value !== undefined) {
    return options.bool ? !!value : value;
  }

  if (options.bool) {
    return element.hasAttribute(name) || defaultValue;
  }

  const attr = element.getAttribute(name);

  if (attr !== null) {
    return guessValue(attr);
  }

  return defaultValue;
}

export function definePropInternal(name: string, options: PropOptions = {}) {
  const { element, update, props } = getCurrentNode();
  const current = getPropValue(element, name as any, options);
  const prop = ref(current);
  const setAttribute = (options.attribute || options.bool) && isValidAttribute(name);

  watch(prop, (value: any) => {
    if (element[name] !== value) {
      element[name] = value;
    }
  });

  Object.defineProperty(element, name, {
    get() {
      return prop.value;
    },
    set(value) {
      prop.value = value;

      for (const fn of update) {
        fn();
      }

      if (setAttribute) {
        element.setAttribute(name, String(value));
      }
    },
  });

  props[name] = prop;

  return prop;
}

async function findSetupModule(template: HTMLTemplateElement) {
  const stateCode = template.content.querySelector("script[state]");
  const setupCode = template.content.querySelector("script[setup]");
  const origin = getOrigin(template);
  let setupFunction;
  let stateFunction;

  if (stateCode) {
    const code = stateCode.textContent.trim();
    stateFunction = () => {
      try {
        return JSON.parse(code);
      } catch {}
    };
    stateCode.remove();
  }

  if (setupCode) {
    const src = setupCode.getAttribute("src");
    const code = setupCode.textContent;
    const mod = src ? import(String(new URL(src, origin))) : importModuleFromSource(code, origin);
    setupFunction = (await mod).default;
    setupCode.remove();
  }

  if (setupFunction && stateFunction) {
    return function () {
      const state = stateFunction();
      const bindings = setupFunction() || {};

      for (const [key, value] of Object.entries(state)) {
        const $ = bindings[key];
        if (isWritableRef($)) {
          $.value = value;
        } else {
          bindings[key] = value;
        }
      }

      return bindings;
    };
  }

  return setupFunction || stateFunction || Function;
}

async function findStyleSheets(template: HTMLTemplateElement): Promise<CSSStyleSheet[]> {
  const styleTags = Array.from(template.content.querySelectorAll("style")) as HTMLStyleElement[];
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
  const links = linkTags.map((link) => {
    const href = String(new URL(link.href, origin));
    const sheet = importCssModule(href);
    link.remove();
    return sheet;
  });

  return (await Promise.all(links)).concat(styles);
}

function findRefs(template: HTMLTemplateElement) {
  const list = Array.from(template.content.querySelectorAll("ref"));
  return list.map((r) => {
    r.remove();
    const name = r.getAttribute("name");
    const setterName = r.getAttribute("setter");
    return [name, r.getAttribute("value"), setterName];
  });
}

export function loadDependencies(template: HTMLTemplateElement) {
  const links = Array.from(template.content.querySelectorAll("link[rel=component]")) as HTMLLinkElement[];
  const origin = getOrigin(template);

  for (const link of links) {
    load(link.href, origin);
    link.remove();
  }
}

export function tpl(s: string) {
  const template = document.createElement("template");
  template.innerHTML = String(s).trim();

  return template;
}

export async function readOptionsFromTemplate(template: HTMLTemplateElement) {
  loadDependencies(template);

  const options: MountOptions = {
    template,
    setup: await findSetupModule(template),
    styles: await findStyleSheets(template),
    refs: findRefs(template),
  };

  return options;
}

export async function defineFromTemplate(
  template: HTMLTemplateElement | string,
): Promise<DefineComponentOptions | null> {
  if (typeof template === "string") {
    template = tpl(template);
  }

  const name = template.getAttribute("component") as string;

  if (!name) {
    return null;
  }

  const options = await readOptionsFromTemplate(template);
  defineComponent(name, options);

  return { name, ...options };
}

export async function findApps(): Promise<void> {
  const apps = Array.from(document.querySelectorAll("template[app]")) as HTMLTemplateElement[];

  await Promise.all(
    apps.map(async (template) => {
      try {
        const options = await readOptionsFromTemplate(template);
        // SSR hydration: reuse the projection div the server rendered (marked
        // with data-li3-root) instead of creating a duplicate app root.
        // Contents are still fully re-rendered by mount() (innerHTML = '').
        const prev = template.previousElementSibling as HTMLElement | null;
        const app =
          FF.ssr && prev?.hasAttribute?.("data-li3-root")
            ? prev
            : Object.assign(document.createElement("div"), { style: "display: contents" });

        if (FF.ssr) {
          app.setAttribute("data-li3-root", "");
        }
        app.style.display = "contents";
        template.parentNode!.insertBefore(app, template);

        const unmount = mount(app, options);
        await unmount.ready;
        // SSR keeps the source template as the client re-rendering blueprint.
        FF.debug || FF.ssr || template.remove();
      } catch (error) {
        console.error(error);
      }
    }),
  );
}

export async function autoInitialize(): Promise<void> {
  const components = Array.from(document.querySelectorAll("template[component]")) as HTMLTemplateElement[];
  const links = Array.from(document.querySelectorAll('link[rel="component"]')) as HTMLLinkElement[];

  await Promise.all([
    ...components.map((component) => defineFromTemplate(component)),
    ...links.map((link) => load(link.href)),
  ]);
  await findApps();
  await waitForCodePlanMounts();
}

// give time to import the module and set feature flags
setTimeout(() => {
  if (!FF.skipAutoInitialize) {
    if (["complete", "interactive"].includes(document.readyState)) {
      return autoInitialize().catch((error) => console.error(error));
    }

    window.addEventListener("DOMContentLoaded", () => autoInitialize().catch((error) => console.error(error)));
  }
}, 10);
