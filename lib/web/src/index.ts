import { elementRoles } from 'aria-query';

export type AnyFunction = (...args: any[]) => any;

export type PropOptions<T = any> = {
  default?: T | (() => T);
};

export type RuntimeContext = {
  element: any;
  mount: AnyFunction[];
  update: AnyFunction[];
  unmount: AnyFunction[];
  props: Record<PropertyKey, any>;
  refs: Record<PropertyKey, any>;
};

export type Signal<T = any> = {
  [refSymbol]: boolean;
  internalValue: T | undefined;
  dependencies: Set<Signal>;
  watchers: Set<AnyFunction>;
  value: T | undefined;
  update(value?: T): void;
};

export type MountOptions = {
  template: HTMLTemplateElement;
  setup?: Function;
  styles?: CSSStyleSheet[];
  shadowDom?: boolean | string | ShadowRootInit;
};

export type DefineComponentOptions = MountOptions & {
  name: string;
  template: HTMLTemplateElement | string;
};

const currentNodeStack: RuntimeContext[] = [];
const signalsStack: Signal[] = [];
const refSymbol = Symbol("$");
const contextRef = Symbol("#");
const reactiveTag = Symbol("#");
const unwrapTag = Symbol("#");

export const DEBUG = Symbol("#");

export function noop() {}

function getShadowDomOptions(
  template: HTMLTemplateElement,
): ShadowRootInit | undefined {
  const source = template.getAttribute("shadow-dom") || "";

  if (source) {
    return source.startsWith("{")
      ? JSON.parse(source)
      : { mode: source as ShadowRootMode };
  }
}

export function defineComponent(options: DefineComponentOptions) {
  const { name } = options;
  options.template =
    typeof options.template === "string"
      ? tpl(options.template)
      : options.template;
  const shadowDom: ShadowRootInit | undefined =
    options.shadowDom === true
      ? { mode: "open" }
      : getShadowDomOptions(options.template);

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

export function getElement() {
  return getCurrentNode().element;
}

export function mount(target: Element, options: MountOptions) {
  const parentElement = target.shadowRoot || target;
  const { template, setup = noop } = options;
  const dom = template.content.cloneNode(true);

  let context;
  const runtime: RuntimeContext = {
    element: target,
    mount: [],
    update: [],
    unmount: [],
    props: {},
    refs: {},
  };

  currentNodeStack.push(runtime);

  try {
    context = setup() ?? {};
  } finally {
    currentNodeStack.pop();
  }
  const mergedContext = Object.assign({}, context, runtime.props, runtime.refs);
  const readOnlyContext = createReadOnlyContext(mergedContext);
  walkNodes(dom, bindNode, readOnlyContext);

  parentElement.innerHTML = "";
  parentElement.appendChild(dom);

  if (options.styles?.length) {
    (target.shadowRoot || document).adoptedStyleSheets.push(...options.styles);
  }

  for (const fn of runtime.mount) {
    fn();
  }

  if (window.name === "debug") {
    (parentElement as any)[DEBUG] = { options, context: readOnlyContext };
  }

  const unmountHooks = runtime.unmount;
  return function () {
    for (const fn of unmountHooks) {
      fn();
    }
  };
}

export function compare(a: any, b: any) {
  const typeA = typeof a;
  const typeB = typeof b;

  if (typeA !== typeB) {
    return false;
  }

  if (typeA === "object") {
    if (a === null || b === null) {
      return a === b;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        return false;
      }

      for (let i = 0; i < a.length; i++) {
        if (!compare(a[i], b[i])) {
          return false;
        }
      }

      return true;
    }

    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    if (a instanceof RegExp && b instanceof RegExp) {
      return a.toString() === b.toString();
    }

    if (a instanceof Error && b instanceof Error) {
      return a.message === b.message;
    }

    return a === b;
  }

  if (typeA === "function") {
    return String(a) === String(b);
  }

  if (Number.isNaN(a) && Number.isNaN(b)) {
    return true;
  }

  return a === b;
}

export function canBeObserved(object: any): boolean {
  return (
    object !== null &&
    object !== undefined &&
    typeof object === "object" &&
    !object[reactiveTag]
  );
}

export function reactive<T extends object>(object: T, effect: AnyFunction): T {
  if (!canBeObserved(object)) {
    return object;
  }

  const values = Object.entries(object);
  for (const [key, next] of values) {
    if (typeof next === "object" && next !== null) {
      (object as any)[key] = reactive(next, effect);
    }
  }

  return new Proxy(object, {
    get(target: any, p) {
      if (p === reactiveTag) {
        return true;
      }

      if (p === unwrapTag) {
        return object;
      }

      return target[p];
    },

    set(target: any, p, value) {
      if ((target as any)[p] === value) {
        return false;
      }

      if (typeof value === "object" && value !== null) {
        value = reactive(value, effect);
      }

      target[p] = value;
      effect();
      return true;
    },
    deleteProperty(target: any, p) {
      delete target[p];
      effect();
      return true;
    },
  });
}

/**
 * Unwraps a reactive object to its original form.
 * This is useful when you want to access the original object
 * without the reactive proxy.
 *
 * @param {object} object The proxy object to unwrap
 * @returns {object} the original object
 */
export function unwrap<T = any>(object: T): T {
  if (object === null || object === undefined) {
    return object;
  }

  if ((object as any)[unwrapTag]) {
    return (object as any)[unwrapTag];
  }

  if (isRef(object)) {
    return object.value;
  }

  return object;
}

export function ref<T = any>(initial?: T, isShallow = false) {
  const o: Signal = {
    [refSymbol]: true,
    internalValue: initial,
    dependencies: new Set(),
    watchers: new Set(),

    get value() {
      captureDependency(o);
      return o.internalValue;
    },

    set value(newValue) {
      o.update(newValue);
    },

    update(newValue: any) {
      let lastValue = o.internalValue;
      o.internalValue = newValue;

      if (!isShallow && typeof newValue === "object" && newValue !== null) {
        newValue = reactive(newValue as object, () => {
          notifyDependencies(o);
          notifyWatchers(o, lastValue);
        });
      }

      notifyDependencies(o);
      notifyWatchers(o, lastValue);
    },
  };

  return o;
}

export function shallowRef<T>(value?: T) {
  return ref<T>(value, true);
}

export function isRef(t: any): t is Signal {
  return Boolean(t && t[refSymbol]);
}

export function computed<T = any>(fn: AnyFunction) {
  const o: Signal<T> = {
    [refSymbol]: true,
    internalValue: undefined,
    dependencies: new Set(),
    watchers: new Set(),

    get value() {
      captureDependency(o);
      return o.internalValue;
    },

    set value(_) {
      throw new Error("Computed value cannot be set");
    },

    update(value = fn()) {
      let lastValue = o.internalValue;

      if (compare(lastValue, value)) return;

      o.internalValue = value;
      notifyDependencies(o);
      notifyWatchers(o, lastValue);
    },
  };

  signalsStack.push(o);

  try {
    o.update();
  } catch (e) {
    console.error(e);
  } finally {
    signalsStack.pop();
  }

  return o;
}

export function watch(target: Signal, fn: AnyFunction) {
  target.watchers.add(fn);
  fn(target.value);

  return () => {
    target.watchers.delete(fn);
  };
}

export function effect(fn: AnyFunction, effectFn: AnyFunction) {
  return watch(computed(fn), effectFn);
}

export function onInit(fn: any) {
  getCurrentNode().mount.push(fn);
}

const debounce = (fn: any) => {
  let timer: any = 0;
  return function (...args: any[]) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), 1);
  };
};

export function onUpdate(fn: any) {
  getCurrentNode().update.push(debounce(fn));
}

export function onDestroy(fn: any) {
  getCurrentNode().unmount.push(fn);
}

function getPropValue<T extends keyof Element>(
  element: Element,
  name: T,
  defaultValue: any,
) {
  const value = element[name];

  if (value !== undefined) {
    return value;
  }

  const attr = element.getAttribute(name);

  if (attr !== null) {
    return attr;
  }

  if (defaultValue !== undefined) {
    return typeof defaultValue === "function" ? defaultValue() : defaultValue;
  }
}

export function defineProp(name: string, options: PropOptions = {}) {
  const { element, update } = getCurrentNode();
  const current = getPropValue(element, name as keyof Element, options.default);
  const prop = ref(current);

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
    },
  });

  getCurrentNode().props[name] = prop;

  return prop;
}

export function defineEvent(name: string) {
  const { element } = getCurrentNode();

  return function emitter(value: any) {
    const event = new CustomEvent(name, { detail: value });
    element.dispatchEvent(event);
    const handler = element["on" + name];
    if (typeof handler === "function") {
      handler(event);
    }
  };
}

export function templateRef(name: string | number) {
  const $ref = ref(null);
  getCurrentNode().refs[name] = $ref;
  return $ref;
}

function notifyDependencies(target: Signal) {
  for (const dep of target.dependencies) {
    dep.update();
  }
}

function notifyWatchers(target: Signal, lastValue: any) {
  const value = target.value;

  if (lastValue !== value && target.watchers.size > 0) {
    for (const watcher of target.watchers) {
      watcher(value, lastValue);
    }
  }
}

function captureDependency(o: Signal) {
  const d = signalsStack.at(-1);

  if (d && d !== o) {
    o.dependencies.add(d);
  }
}

function getCurrentNode() {
  const t = currentNodeStack.at(-1);

  if (!t) {
    throw new Error("Missing context for this component");
  }

  return t;
}

function walkNodes(tree: { childNodes: any }, fn: AnyFunction, context: any) {
  for (const node of tree.childNodes) {
    fn(node, context);

    if (
      node.nodeType === Node.ELEMENT_NODE &&
      !node.hasAttribute("do-not-render")
    ) {
      walkNodes(node, fn, context);
    }
  }
}

function walkAttributes(node: Element, fn: AnyFunction, context: any) {
  for (const attr of Array.from(node.attributes)) {
    fn(node, attr.name, attr.value.trim(), context);
  }
}

function createFunction(
  expression: string,
  keys: string[],
  context: any,
  args: string[] = [],
) {
  const k = keys
    .filter((key: any) => expression.includes(key))
    .join(", ")
    .trim();
  return Function(
    ...args,
    (k ? `const { ${k} } = this;` : "") + `return ${expression};`,
  ).bind(context);
}

function createReadOnlyContext(context: any) {
  context[contextRef] = context;

  return new Proxy(context, {
    get(target, key) {
      if (target[key] !== undefined) {
        if (target[key] && target[key][refSymbol]) {
          return target[key].value;
        }

        return target[key];
      }
    },

    set() {
      throw new Error("View contexts are read-only");
    },
  });
}

function bindNode(node: Text | Element, context: any) {
  if (node.nodeType === node.TEXT_NODE) {
    if (node.textContent.trim()) {
      bindText(node as Text, context);
    }
    return;
  }

  if (node.nodeType === node.ELEMENT_NODE) {
    walkAttributes(node as Element, bindAttribute, context);
  }
}

function bindText(node: Text, context: {}) {
  const template = node.textContent.trim();

  if (!template || !template.includes("{{")) return;

  const keys = Object.keys(context);
  const source =
    "`" +
    template.replace(
      /{{(.*?)}}/g,
      (_: any, exp: string) => "${" + exp.trim() + "}",
    ) +
    "`";

  effect(
    createFunction(source, keys, context),
    (v: any) => (node.textContent = v),
  );
}

const mappedProperties: Record<string, string> = {
  innerhtml: "innerHTML",
  baseurl: "baseURL",
};

export function setClassName(
  el: Element,
  classNames: string,
  value: any,
): void {
  for (const cls of classNames.split(".").filter(Boolean)) {
    el.classList.toggle(cls, value);
  }
}

export function setStyle(el: any, key: string, value: any): void {
  el.style[key] = value;
}

export function setText(el: Text, text: any): void {
  el.textContent = String(text);
}

export function setProperty(node: any, key: string, value: any) {
  const mappedKey = mappedProperties[key] || key;
  node[mappedKey] = value;
}

const validAttribute = /^[a-zA-Z_][a-zA-Z0-9\-_:.]*$/;
export function setAttribute(
  el: Element,
  attribute: string,
  value: boolean,
): void {
  if (!validAttribute.test(attribute)) {
    return;
  }

  if (typeof value === "boolean" && value === false) {
    el.removeAttribute(attribute);
    return;
  }

  el.setAttribute(attribute, String(value));
}

function bindAttribute(
  node: HTMLElement,
  name: string,
  value: string,
  context: any,
) {
  const keys = Object.keys(context);

  if (name === "ref") {
    const key = value.trim();
    context[contextRef][key] ||= ref(null);
    context[contextRef][key].value = node;
    return;
  }

  if (name.startsWith("on-")) {
    const key = name.slice(3);
    const [event, ...tags] = key.split(".");
    const modifiers: any = {};

    for (const tag of tags) {
      modifiers[tag] = true;
    }

    const fn = createFunction(value, keys, context, ["$event"]);
    node.addEventListener(event, (e: Event) => {
      if (modifiers.stop) e.stopPropagation();
      if (modifiers.prevent) e.preventDefault();

      return fn(e);
    });
    node.removeAttribute(name);
    return;
  }

  if (name.startsWith("attr-")) {
    const key = name.slice(5);
    const source = value.trim();
    effect(createFunction(source, keys, context), (v: any) =>
      setAttribute(node, key, v),
    );
    node.removeAttribute(name);
    return;
  }

  if (name.startsWith("bind-")) {
    const key = name.slice(5);
    const source = value.trim();
    effect(createFunction(source, keys, context), (value: any) =>
      setProperty(node, key, value),
    );
    node.removeAttribute(name);
    return;
  }

  if (name.startsWith("class-")) {
    const key = name.slice(6);
    const source = value.trim();

    effect(createFunction(source, keys, context), (value: any) =>
      setClassName(node, key, value),
    );
    node.removeAttribute(name);
    return;
  }

  if (name.startsWith("style-")) {
    const key = name
      .slice(6)
      .replace(/-([a-z])/g, (_: any, letter: string) => letter.toUpperCase());
    const source = value.trim();
    effect(createFunction(source, keys, context), (value: any) =>
      setStyle(node, key, value),
    );
    node.removeAttribute(name);
    return;
  }

  if (node.nodeName === "TEMPLATE" && name === "for") {
    const source = value.trim();
    const [left, expression] = source.split("of").map((s) => s.trim());
    const forNodes: any[] = [];

    effect(createFunction(expression, keys, context), (value: any) => {
      for (const node of forNodes) {
        node.remove();
      }

      forNodes.length = 0;

      if (!Array.isArray(value)) return;

      const length = value.length;
      const [key, indexKey] = left.includes("[")
        ? left.slice(1, -1).split(",")
        : [left, "index"];

      for (let i = 0; i < length; i++) {
        const dom = (node as HTMLTemplateElement).content.cloneNode(true);
        forNodes.push(...Array.from(dom.childNodes));

        const subContext = {
          [key]: value[i],
          [indexKey]: i,
        };

        const reader = createReadOnlyContext(
          Object.assign({}, context, subContext),
        );
        walkNodes(dom, bindNode, reader);

        setTimeout(() => {
          (node as any).parentNode.insertBefore(dom, node);
        });
      }
    });
    node.removeAttribute(name);
    return;
  }

  if (node.nodeName === "TEMPLATE" && name === "if") {
    const source = value.trim();
    const ifNodes: any[] = [];
    let lastValue: any;

    effect(createFunction(source, keys, context), (value: any) => {
      if (compare(value, lastValue)) {
        return;
      }

      lastValue = value;

      if (value && !ifNodes.length) {
        const dom = (node as HTMLTemplateElement).content.cloneNode(true);
        ifNodes.push(...Array.from(dom.childNodes));

        walkNodes(dom, bindNode, context);
        setTimeout(() => {
          (node as any).parentNode.insertBefore(dom, node);
        });
        return;
      }

      if (!value && ifNodes.length) {
        for (const node of ifNodes) {
          node.remove();
        }

        ifNodes.length = 0;
      }
    });
    node.removeAttribute(name);
    return;
  }
}

async function importModuleFromSource(code: BlobPart) {
  const blob = URL.createObjectURL(
    new Blob([code], { type: "text/javascript" }),
  );
  const module = await import(blob);
  URL.revokeObjectURL(blob);
  return module;
}

async function findSetupModule(template: HTMLTemplateElement) {
  const setupCode = template.content.querySelector("script[setup]");

  if (setupCode) {
    const url = setupCode.getAttribute("src");
    const code = setupCode.textContent;
    const mod = url
      ? import(new URL(url, window.location.href).toString())
      : importModuleFromSource(code);
    setupCode.remove();

    return (await mod).default;
  }

  return noop;
}

function findStyleSheets(template: HTMLTemplateElement): CSSStyleSheet[] {
  const styleTags = Array.from(
    template.content.querySelectorAll("style"),
  ) as HTMLStyleElement[];

  if (!styleTags.length) {
    return [];
  }

  return styleTags
    .map((tag) => {
      const sheet = tag.sheet;
      tag.remove();
      return sheet;
    })
    .filter(Boolean) as CSSStyleSheet[];
}

export function tpl(s: string) {
  const template = document.createElement("template");
  template.innerHTML = String(s).trim();

  return template;
}

export async function defineFromTemplate(
  template: HTMLTemplateElement | string,
) {
  if (typeof template === "string") {
    template = tpl(template);
  }

  const name = template.getAttribute("component") as string;

  if (!name) {
    return null;
  }

  const options: DefineComponentOptions = {
    name,
    template,
    setup: await findSetupModule(template),
    styles: findStyleSheets(template),
  };

  defineComponent(options);
  return options;
}

export function defineFromString(html: string) {
  const dom = new DOMParser().parseFromString(html, "text/html");
  const nodes = dom.querySelectorAll("template[component]");

  return (Array.from(nodes) as HTMLTemplateElement[]).map(defineFromTemplate);
}

export async function findApps() {
  const apps = Array.from(
    document.querySelectorAll("template[app]"),
  ) as HTMLTemplateElement[];

  for (const template of apps) {
    const options: MountOptions = {
      template,
      setup: await findSetupModule(template),
    };

    const app = document.createElement("div");
    app.style.display = "contents";
    template.parentNode!.insertBefore(app, template);

    mount(app, options);
  }
}

export async function load(href: string | URL) {
  const response = await fetch(new URL(href, window.location.href));

  if (!response.ok) {
    throw new Error("Failed to load components from " + href);
  }

  const html = await response.text();
  return defineFromString(html);
}

const stylesheetCache = new Map<string, Promise<CSSStyleSheet>>();
let _importCssModule: any = importModuleFromSource(
  'export default function(href) { return import(href, { with: { type: "css" } }) }',
);

async function importCssModule(href: string) {
  if (typeof _importCssModule !== "function") {
    _importCssModule = (await _importCssModule).default;
  }

  try {
    return (await _importCssModule(href)).default;
  } catch {
    // fallback for Safari
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@import url(${href})`);
    return sheet;
  }
}

export function loadCss(href: string | URL) {
  href = String(href);
  const element = getElement();

  if (!stylesheetCache.has(href)) {
    stylesheetCache.set(href, importCssModule(href));
  }

  const stylesheet = stylesheetCache.get(href);
  stylesheetCache
    .get(href)
    ?.then((s) => (element.shadowRoot || document).adoptedStyleSheets.push(s));

  return stylesheet;
}

function autoInitialize() {
  const list = Array.from(
    document.querySelectorAll("template[component]"),
  ) as HTMLTemplateElement[];

  list.forEach(defineFromTemplate);

  findApps();
}

if (document.readyState === "complete") {
  autoInitialize();
} else {
  window.addEventListener("DOMContentLoaded", autoInitialize);
}
