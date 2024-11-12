import type { ComponentRuntime, ComponentInitialization, ComponentDefinitions } from "./types";

let domParser: DOMParser;
const getDomParser = () => domParser || (domParser = new DOMParser());
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const stack: ComponentRuntime[] = [];
const fnCache = new Map();

export function getCurrentInstance(): ComponentRuntime {
  return stack[stack.length - 1];
}

export function loadCss(url: string, options: { id?: string; condition?: boolean } = {}): void {
  const { id, condition } = options;
  getCurrentInstance().stylesheets.push([url, id, condition]);
}

export function loadScript(url: string, options: { id?: string; condition?: boolean } = {}): void {
  const { id, condition } = options;
  getCurrentInstance().scripts.push([url, id, condition]);
}

export function onInit(fn: VoidFunction): void {
  getCurrentInstance().init = fn;
}

export function onDestroy(fn: VoidFunction): void {
  getCurrentInstance().destroy = fn;
}

export function computed<T>(fn: () => T): Ref<T> {
  const $ref = ref<T>(null, { shallow: true });
  watch(() => {
    const v = fn();
    if ($ref.value !== v) {
      $ref.value = v;
    }
  });

  return $ref;
}

export function defineEvents(eventNames: any): EventEmitter {
  const el = getCurrentInstance().element;

  if (isElement(el)) {
    for (const event of eventNames) {
      defineEventOnElement(el, event);
    }
  }

  return emitEvent.bind(null, el);
}

function getPropValue($el: ComponentInitialization, property: string, definition: any) {
  if ($el.props && property in $el.props) {
    return $el.props[property];
  }

  if ($el.element.hasOwnProperty(property)) {
    return $el.element[property];
  }

  if (isElement($el.element) && $el.element.hasAttribute(property.toLowerCase())) {
    return $el.element.getAttribute(property);
  }

  if (definition && definition.hasOwnProperty("default")) {
    if (typeof definition.default === "function") {
      return definition.default();
    }

    return definition.default;
  }
}

export function defineProps(definitions: string[] | Record<string, any>): any {
  const $el = getCurrentInstance();
  const keys = !Array.isArray(definitions) ? Object.keys(definitions) : definitions;
  const { element, state } = $el;
  const props = {};

  for (const property of keys) {
    let initialValue = getPropValue($el, property, definitions[property]);

    const $ref = $el.reactive.ref(initialValue);
    state[property] = $ref;
    props[property] = $ref;

    if (!isElement(element)) {
      continue;
    }

    Object.defineProperty(element, property, {
      get() {
        return $ref.value;
      },
      set(value) {
        $ref.value = value;
      },
    });
  }

  return new Proxy(
    { __w: true },
    {
      get(_t, p) {
        if (p === "__w") return true;

        if (props[p]) {
          return props[p].value;
        }
      },
      set(_t, p, value) {
        if (props[p] && props[p].value !== value) {
          $el.reactive.suspend();
          props[p].value = value;
          $el.reactive.unsuspend();
        }

        return true;
      },
    }
  );
}

export function watch(expression: AnyFunction, effect?: AnyFunction): void {
  return getCurrentInstance().reactive.watch(expression, effect);
}

export function ref<T>(value?: T, options?): Ref<T> {
  return getCurrentInstance().reactive.ref(value, options);
}

export function shallowRef<T>(value?: T, options = {}): Ref<T> {
  return ref(value, { ...options, shallow: true });
}

type InjectionEvent<T> = CustomEvent & { result?: T };

export function provide<T>(token: Symbol, provider): void {
  const fn = typeof provider === "function" ? provider : () => provider;
  const { element } = getCurrentInstance();

  element.addEventListener("$inject", (e: InjectionEvent<T>) => {
    if (e.detail === token) {
      e.result = fn();
      e.stopPropagation();
    }
  });
}

export function inject<T>(token: any) {
  const { element } = getCurrentInstance();
  const event = new CustomEvent("$inject", { detail: token, bubbles: true }) as CustomEvent & { result: T };

  element.dispatchEvent(event);

  const result = event.result;

  if (!result) {
    throw new Error("Injectable not found: " + token);
  }

  return result;
}

export function html(text: string) {
  const dom = new DOMParser().parseFromString(text, "text/html");
  return parseDomTree(dom.body);
}

export function tpl(text: string) {
  const template = document.createElement("template");
  template.innerHTML = text;
  return template;
}

export function parseDomTree(tree) {
  const children = mapTree(tree, (element) => {
    if (element.nodeType === element.TEXT_NODE) {
      const text = (element as Text).textContent;

      // TODO think about pre/code content
      return text.trim() || undefined;
    }

    if (isElement(element)) {
      return [element.nodeName.toLowerCase(), getAttributes(element), []];
    }
  });

  return ["#", "html", children];
}

function mapTree<T extends ChildNode | Document | DocumentFragment | HTMLTemplateElement>(
  tree: T,
  mapper: (node: T) => any
) {
  const nodes: T[] = (tree["content"] || tree).childNodes;
  return Array.from(nodes)
    .map((next) => {
      const parsed = mapper(next);
      const nodes: T[] = parsed ? (next["content"] || next).childNodes : undefined;
      if (nodes && nodes.length) {
        parsed[2] = mapTree(next, mapper);
      }

      return parsed;
    })
    .filter((node) => node !== undefined);
}

export function getAttributes(node: Element) {
  return node.attributes ? Array.from(node.attributes).map((a) => [a.localName, a.value]) : [];
}

export function defineEventOnElement(el: Element, name: string): void {
  const property = "on" + name.toLowerCase();
  if (!el.hasOwnProperty(property)) {
    Object.defineProperty(el, property, { value: null });
  }
}

export function emitEvent(element: Element, eventName: string, detail: any): void {
  const event = new CustomEvent(eventName, { detail });
  element.dispatchEvent(event);
}

export async function createInstance($el: ComponentInitialization): Promise<ComponentInitialization> {
  stack.push($el);

  try {
    const { reactive } = $el;
    reactive.suspend();
    createState($el);
    createDom($el);
    reactive.unsuspend();
    reactive.check();

    if ($el.destroy) {
      ($el.element as any).__destroy = $el.destroy;
    }

    if ($el.init) {
      $el.init();
    }
  } catch (error) {
    console.log("Failed to initialize component!", this, error);
  }

  stack.pop();

  return $el;
}

export function fork(base: any, delegate: any, callback: AnyFunction) {
  return new Proxy(delegate, {
    get(_t, p) {
      return base.hasOwnProperty(p) ? base[p] : delegate[p];
    },
    set(_t, p, v) {
      if (delegate.hasOwnProperty(p)) {
        delegate[p] = v;
      } else {
        base[p] = v;
      }

      callback();
      return true;
    },
  });
}

export function createState($el: ComponentInitialization): void {
  $el ||= getCurrentInstance();
  const componentData = $el.setup($el, $el.element) || {};
  $el.state = $el.reactive.watchDeep({ ...componentData, ...$el.state });
  $el.stateKeys = Object.keys($el.state);

  if ($el.parent) {
    const keys = Object.keys($el.state);
    $el.state = fork($el.parent.state, $el.state, $el.reactive.check);
    // TODO unique keys
    $el.stateKeys = keys.concat($el.parent.stateKeys);
  }

  Object.freeze($el.state);
  Object.freeze($el.stateKeys);
}

export function clearElement(element: Element | DocumentFragment) {
  if (isFragment(element)) {
    element.childNodes.forEach((e) => e.remove());
    return;
  }

  element.innerHTML = "";
}

export function createDom($el: ComponentInitialization): void {
  $el ||= getCurrentInstance();
  const { element, template, shadowDom, stylesheets, scripts, state } = $el;
  let dom: any = template;

  if (Array.isArray(template)) {
    dom = materialize(template);
  }

  if (template["content"]) {
    dom = template["content"].cloneNode(true);
  }

  const visitor = createBindings.bind(null, state);

  traverseDom(dom, visitor);
  clearElement(element);

  if (!shadowDom || isFragment(element)) {
    element.append(dom);
  } else {
    element.attachShadow(shadowDom as ShadowRootInit);
    element.shadowRoot.append(dom);
  }

  for (const [a, b, c] of stylesheets) {
    injectCssIntoElement(element, a, b, c);
  }

  for (const [a, b, c] of scripts) {
    injectScriptIntoElement(element, a, b, c);
  }

  const templates: HTMLTemplateElement[] = Array.from((element["shadowRoot"] || element).querySelectorAll("template"));
  const templateLoops = templates.filter((t) => t.hasAttribute("for"));
  for (const t of templateLoops) {
    templateForOf(t, $el);
  }

  const templateConditions = templates.filter((t) => t.hasAttribute("if"));
  for (const t of templateConditions) {
    templateIf(t, $el);
  }
}

export function compileExpression(expression: string, args: string[] = []): AnyFunction {
  const { state, stateKeys } = getCurrentInstance();
  const usedKeys = stateKeys.filter((k) => expression.includes(k));
  const code =
    (usedKeys.length ? usedKeys.map((k) => `const ${k} = __u(__s.${k})`).join(";") + ";" : "") +
    `\nreturn ${expression}`;
  const cacheKey = code + args;
  let fn = fnCache.get(cacheKey);

  if (!fn) {
    const parsed = getDomParser().parseFromString(code, "text/html");
    const finalCode = parsed.body.innerText.trim();
    const functionType = expression.includes("await ") ? AsyncFunction : Function;
    fn = functionType(...["__s", "__u", ...args], finalCode);
    fnCache.set(cacheKey, fn);
  }

  return fn.bind(state, state, unref);
}

////////// Custom Elements API

export const noop = () => {};
export const DefineComponent = Symbol("@@def");

export function createComponent(name: string, def: ComponentDefinitions): void {
  if (customElements.get(name)) {
    customElements.get(name)![DefineComponent] = def;
    // TODO propagate updates to all instances
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

function isFragment(node: any): node is DocumentFragment {
  return node && node.nodeType === node.DOCUMENT_FRAGMENT_NODE;
}
