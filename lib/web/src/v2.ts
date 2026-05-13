type AnyFunction = (...args: any[]) => any;

type PropOptions<T = any> = {
  default?: () => T | T;
};

type RuntimeContext = {
  root: any;
  mount: AnyFunction[];
  update: AnyFunction[];
  unmount: AnyFunction[];
  props: Record<PropertyKey, any>;
  refs: Record<PropertyKey, any>;
};

type Signal<T = any> = {
  [refSymbol]: boolean;
  internalValue: T | undefined;
  dependencies: Set<Signal>;
  watchers: Set<AnyFunction>;
  value: T | undefined;
  update(value?: T): void;
};

type MountOptions = {
  template: HTMLTemplateElement;
  setup?: Function;
  shadowDom?: boolean;
};

type DefineComponentOptions = MountOptions & { name: string };

const currentNodeStack: RuntimeContext[] = [];
const signalsStack: Signal[] = [];
const refSymbol = Symbol("ref");
const contextRef = Symbol("context");

export function noop() {}

export function defineComponent(options: DefineComponentOptions) {
  const { name } = options;

  class Component extends HTMLElement {
    unmount: Function | null = null;

    constructor() {
      super();

      if (options.shadowDom !== false) {
        this.attachShadow({ mode: "open" });
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

export function mount(target: Element, options: MountOptions) {
  const root = target.shadowRoot || target;
  const { template, setup = noop } = options;
  const dom = template.content.cloneNode(true);

  let context;
  const hooks: RuntimeContext = {
    root: target,
    mount: [],
    update: [],
    unmount: [],
    props: {},
    refs: {},
  };

  currentNodeStack.push(hooks);

  try {
    context = setup() ?? {};
  } finally {
    currentNodeStack.pop();
  }

  Object.assign(context, hooks.props, hooks.refs);

  const reader = createContextReader(context);
  walkNodes(dom, bindNode, reader);

  root.innerHTML = "";
  root.appendChild(dom);

  for (const fn of hooks.mount) {
    fn();
  }

  return function () {
    for (const fn of hooks.unmount) {
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

    if (["string", "number", "function"].includes(typeA)) {
      return String(a) === String(b);
    }

    return a === b;
  }

  return false;
}

export function ref<T = any>(initial: T) {
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

      notifyDependencies(o);
      notifyWatchers(o, lastValue);
    },
  };

  return o;
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

export function onMount(fn: any) {
  getCurrentNode().mount.push(fn);
}

export function onUpdate(fn: any) {
  getCurrentNode().update.push(fn);
}

export function onUnmount(fn: any) {
  getCurrentNode().unmount.push(fn);
}

export function defineProp(name: PropertyKey, options: PropOptions = {}) {
  const { default: defaultValue } = options;
  const target = getCurrentNode().root;
  const hooks = getCurrentNode().update;
  const current =
    target[name] ??
    (typeof defaultValue === "function" ? defaultValue() : defaultValue);
  const prop = ref(current);

  watch(prop, (value: any) => {
    if (target[name] !== value) {
      target[name] = value;
    }
  });

  Object.defineProperty(target, name, {
    get() {
      return prop.value;
    },
    set(value) {
      prop.value = value;

      for (const fn of hooks) {
        fn();
      }
    },
  });

  getCurrentNode().props[name] = prop;

  return prop;
}

export function defineEvent(name: string) {
  const root = getCurrentNode().root;

  return function emitter(value: any) {
    root.dispatchEvent(new CustomEvent(name, { detail: value }));
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

    if (node.nodeType === Node.ELEMENT_NODE) {
      walkNodes(node, fn, context);
    }
  }
}

function walkAttributes(node: Element, fn: AnyFunction, context: any) {
  for (const attr of Array.from(node.attributes)) {
    fn(node, attr.name, attr.value.trim(), context);
  }
}

function importModule(code: BlobPart) {
  const blob = URL.createObjectURL(
    new Blob([code], { type: "text/javascript" }),
  );
  const module = import(blob);
  URL.revokeObjectURL(blob);
  return module;
}

export function findComponents() {
  const components = [
    ...document.querySelectorAll("template[component]"),
  ] as HTMLTemplateElement[];

  for (const template of components) {
    const name = template.getAttribute("component") as string;

    if (!name) continue;

    const options: DefineComponentOptions = { name, template };
    const setupCode = template.content.querySelector("script[setup]");

    if (setupCode) {
      const code = setupCode.textContent;
      setupCode.remove();
      importModule(code).then((module) => {
        options.setup = module.default;
        defineComponent(options);
      });
    } else {
      defineComponent(options);
    }
  }
}

export function findApps() {
  const apps = [
    ...document.querySelectorAll("template[app]"),
  ] as HTMLTemplateElement[];

  for (const template of apps) {
    const options: MountOptions = { template };
    const root = document.createElement("div");
    template.parentNode!.insertBefore(root, template);

    mount(root, options);
  }
}

function createFunction(
  expression: string,
  keys: string[],
  context: any,
  args: string[] = [],
) {
  return Function(
    ...args,
    `const { ${keys
      .filter((key: any) => expression.includes(key))
      .join(", ")} } = this; return ${expression};`,
  ).bind(context);
}

function createContextReader(context: any, parent?: any) {
  context[contextRef] = context;

  return new Proxy(context, {
    get(target, key) {
      if (target[key] !== undefined) {
        if (target[key] && target[key][refSymbol]) {
          return target[key].value;
        }

        return target[key];
      }

      if (!parent) return;

      if (parent[key] !== undefined) {
        if (parent[key] && parent[key][refSymbol]) {
          return parent[key].value;
        }

        return parent[key];
      }
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

function bindAttribute(
  node: HTMLElement,
  name: string,
  value: string,
  context: any,
) {
  const keys = Object.keys(context);

  if (name === "ref") {
    const key = value.trim();
    context[contextRef][key] = ref(node);
    return;
  }

  if (name.startsWith("on-")) {
    const key = name.slice(3);
    const [event, ...tags] = key.split(".");
    const modifiers = tags.reduce(
      (acc: { [x: string]: boolean }, tag: string | number) => {
        acc[tag] = true;
        return acc;
      },
      {},
    );

    const fn = createFunction(value, keys, context, ["$event"]);
    node.addEventListener(
      event,
      (e: { stopPropagation: () => void; preventDefault: () => void }) => {
        if (modifiers.stop) e.stopPropagation();
        if (modifiers.prevent) e.preventDefault();

        return fn(e);
      },
    );
    node.removeAttribute(name);
    return;
  }

  if (name.startsWith("attr-")) {
    const key = name.slice(5);
    const source = value.trim();
    effect(createFunction(source, keys, context), (v: any) =>
      node.setAttribute(key, v),
    );
    node.removeAttribute(name);
    return;
  }

  if (name.startsWith("bind-")) {
    const key = name.slice(5);
    const source = value.trim();
    effect(
      createFunction(source, keys, context),
      (value: any) => ((node as any)[key] = value),
    );
    node.removeAttribute(name);
    return;
  }

  if (name.startsWith("class-")) {
    const key = name.slice(6);
    const source = value.trim();

    effect(createFunction(source, keys, context), (value: any) =>
      node.classList.toggle(key, !!value),
    );
    node.removeAttribute(name);
    return;
  }

  if (name.startsWith("style-")) {
    const key = name
      .slice(6)
      .replace(/-([a-z])/g, (_: any, letter: string) => letter.toUpperCase());
    const source = value.trim();
    effect(
      createFunction(source, keys, context),
      (value: any) => ((node.style as any)[key] = value),
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
        forNodes.push(...dom.childNodes);

        const subContext = { [key]: value[i], [indexKey]: i };
        const reader = createContextReader(subContext, context);
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

    effect(createFunction(source, keys, context), (value: any) => {
      if (value) {
        const dom = (node as HTMLTemplateElement).content.cloneNode(true);
        ifNodes.push(...dom.childNodes);

        walkNodes(dom, bindNode, context);
        setTimeout(() => {
          (node as any).parentNode.insertBefore(dom, node);
        });
      } else {
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

function autoInitialize() {
  findComponents();
  findApps();
}

if (document.readyState === "complete") {
  autoInitialize();
} else {
  window.addEventListener("DOMContentLoaded", autoInitialize);
}
