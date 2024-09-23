import { Ref, unref, isRef, ReactiveContext } from "@lithium/reactive";

export interface RuntimeInfo {
  shadowDom?: ShadowRootInit;
  reactive: ReactiveContext;
  element: Element;
  props: any;
  stylesheets: Array<[string, string, boolean]>;
  scripts: Array<[string, string, boolean]>;
  state: any;
  parent: any;
  stateKeys: string[];
  template: any[];
  setup: Function;
  init: VoidFunction | null;
  destroy: VoidFunction | null;
}

export interface ComponentDefinitions {
  setup: Function;
  template: any[];
  shadowDom?: ShadowRootInit;
}

export type AnyFunction = (...args: any) => any;

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const domParser = new DOMParser();
const validAttribute = /^[a-zA-Z_][a-zA-Z0-9\-_:.]*$/;
const stack: RuntimeInfo[] = [];

export type EventEmitter = (event: string, detail: any) => void;

///// Setup API

export function getCurrentInstance(): RuntimeInfo {
  return stack[stack.length - 1];
}

export function loadCss(url: string, id: string, condition: boolean): void {
  getCurrentInstance().stylesheets.push([url, id, condition]);
}

export function loadScript(url: string, id: string, condition: boolean): void {
  getCurrentInstance().scripts.push([url, id, condition]);
}

export function onInit(fn: VoidFunction): void {
  getCurrentInstance().init = fn;
}

export function onDestroy(fn: VoidFunction): void {
  getCurrentInstance().destroy = fn;
}

export function computed<T>(fn: () => T): Ref<T> {
  const $ref = ref<T>();
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

  for (const event of eventNames) {
    defineEventOnElement(el, event);
  }

  return emitEvent.bind(null, el);
}

function getPropValue($el: RuntimeInfo, property: string, definition: any) {
  if ($el.props && property in $el.props) {
    return $el.props[property];
  }

  if ($el.element.hasOwnProperty(property)) {
    return $el.element[property];
  }

  if ($el.element.getAttribute && $el.element.hasAttribute(property)) {
    return $el.element.getAttribute(property);
  }

  if (definition && definition.default) {
    if (typeof definition.default === "function") {
      return definition.default();
    }

    return definition.default;
  }
}

export function defineProps(definitions: string[] | Record<string, any>): any {
  const keys = !Array.isArray(definitions) ? Object.keys(definitions) : definitions;

  const $el = getCurrentInstance();
  const { element, state } = $el;
  const props = {};

  for (const property of keys) {
    let initialValue = getPropValue($el, property, definitions[property]);

    const $ref = $el.reactive.ref(initialValue);
    state[property] = $ref;
    props[property] = $ref;

    if (element.nodeType !== element.ELEMENT_NODE) {
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

    if (element.nodeType === element.ELEMENT_NODE) {
      return [element.nodeName.toLowerCase(), getAttributes(element as Element), []];
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

export async function createInstance($el: RuntimeInfo): Promise<RuntimeInfo> {
  stack.push($el);

  try {
    const { reactive } = $el;
    ensureDisplayBlock($el.element.nodeName);
    reactive.suspend();
    createState($el);
    createDom($el);
    reactive.unsuspend();
    reactive.check();

    if ($el.destroy) {
      ($el.element as any).__destroy = $el.destroy;
    }

    if ($el.init) {
      await $el.init();
    }

    const stateNode =
      $el.element.nodeType === $el.element.DOCUMENT_FRAGMENT_NODE ? $el.element.firstElementChild : $el.element;
    if (stateNode) {
      (stateNode as any).$state = $el.state;
    }
  } catch (error) {
    console.log("Failed to initialize component!", this, error);
  }

  stack.pop();

  return $el;
}

export function fork(base: any, delegate: any, callback: AnyFunction) {
  return new Proxy(
    delegate,
    {
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
    }
  );
}

export function createState($el: RuntimeInfo): void {
  $el ||= getCurrentInstance();
  const componentData = $el.setup($el, $el.element);
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

export function createDom($el: RuntimeInfo): void {
  $el ||= getCurrentInstance();
  const { element, template, shadowDom, stylesheets, scripts, state } = $el;
  const dom = Array.isArray(template) ? materialize(template) : template;
  const visitor = createBindings.bind(null, state);

  traverseDom(dom, visitor);
  element.innerHTML = "";

  if (!shadowDom) {
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
}

function ensureDisplayBlock(name: string) {
  if (name && !document.head.querySelector(`[id="ce-${name}"]`)) {
    const css = document.createElement("style");
    css.id = "ce-" + name;
    css.innerText = name.toLowerCase() + "{display:block}";
    document.head.append(css);
  }
}

export function compileExpression(expression: string, args: string[] = []): AnyFunction {
  const { state, stateKeys } = getCurrentInstance();
  const usedKeys = stateKeys.filter((k) => expression.includes(k));
  const code = (usedKeys.length ? `const {${usedKeys.join(",")}} = $state;` : "") + `\nreturn ${expression}`;
  const parsed = domParser.parseFromString(code, "text/html");
  const finalCode = parsed.body.innerText.trim();
  const functionType = expression.includes("await ") ? AsyncFunction : Function;

  return functionType(...["$state", ...args], finalCode).bind(state, state);
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

export interface MountOptions {
  props?: any;
  parent?: any;
}

export function mount(element: Element | string, def: ComponentDefinitions, options?: MountOptions) {
  if (typeof element === "string") {
    element = document.querySelector(element);
  }

  const { setup, template, shadowDom } = def;
  const $el = {
    shadowDom,
    element,
    props: options?.props,
    parent: options?.parent,
    setup,
    stylesheets: [],
    scripts: [],
    template,
    state: {},
    stateKeys: [],
    init: null,
    destroy: null,
    reactive: new ReactiveContext(),
  };

  return Promise.resolve($el).then(createInstance);
}

///// Runtime API

const eventFlags = ["capture", "once", "passive", "stop", "prevent"];

interface Attribute {
  name: string;
  value: string;
}

export function createBindings(state: any, element: Element | Text, attributes: Array<Attribute>): void {
  if (element.nodeType === element.TEXT_NODE) {
    createTextNodeBinding(state, <Text>element);
    return;
  }

  if (element.nodeType === element.ELEMENT_NODE) {
    createElementNodeBindings(state, <Element>element, attributes);
    return;
  }
}

export function createTextNodeBinding(state: any, el: Text): void {
  const text = el.textContent;

  if (text.includes("${") || text.includes("{{")) {
    const expression =
      "`" + text.replace(/\{\{([\s\S]+?)}}/g, (_: any, inner: string) => "${ " + inner.trim() + " }") + "`";
    el.textContent = "";
    const fn = compileExpression(expression);
    watch(wrapTryCatch(expression, fn), (v?: any) => setText(el, v));
  }
}

export function createElementNodeBindings(state: any, el: Element, attrs: any): void {
  if (!Array.isArray(attrs) && attrs.length) return;

  for (const attr of attrs) {
    const attribute = attr[0].trim();
    const expression = attr[1].trim();

    if (attribute.charAt(0) === ":" || attribute.startsWith("bind-")) {
      createElementNodePropertyBinding(state, el, attribute, expression);
      continue;
    }

    if (attribute.charAt(0) === "@" || attribute.startsWith("on-")) {
      createElementNodeEventBinding(state, el, attribute, expression);
      continue;
    }

    if (attribute.startsWith(".class.")) {
      createElementNodeClassBinding(state, el, attribute, expression);
      continue;
    }

    if (attribute.startsWith(".style.")) {
      createElementNodeStyleBinding(state, el, attribute, expression);
      continue;
    }

    if (attribute === "ref") {
      createElementNodeRefBinding(state, el, attribute, expression);
      continue;
    }
  }
}

export function createElementNodeEventBinding(state: any, el: Element, attribute: string, expression: string): void {
  const normalized = attribute.startsWith("@") ? attribute.slice(1) : attribute.replace("on-", "");
  const [eventName, ...flags] = normalized.split(".");
  const exec = compileExpression(expression, ["$event"]);
  const options = {};

  for (const flag of eventFlags) {
    options[flag] = flags.includes(flag);
  }

  setEventHandler(
    el,
    eventName,
    (e: any) => {
      try {
        exec(e);
      } catch (e) {
        console.error("event failed", expression, e);
      }
    },
    options
  );
}

export function createElementNodeRefBinding(
  context: { [x: string]: { value: any } },
  el: unknown,
  _attribute: any,
  expression: string
): void {
  const ref = expression.trim();

  if (isRef(context[ref])) {
    context[ref].value = el;
  }
}

export function createElementNodeClassBinding(state: any, el: any, attribute: string, expression: string): void {
  const classNames = attribute.replace(".class.", "").replace("class-", "");
  const fn = compileExpression(expression);
  watch(wrapTryCatch(expression, fn), (v?: any) => setClassName(el, classNames, v));
}

export function createElementNodeStyleBinding(state: any, el: any, attribute: string, expression: string): void {
  const style = attribute.replace(".style.", "");
  const fn = compileExpression(expression);
  watch(wrapTryCatch(expression, fn), (v: any) => setStyle(el, style, v));
}

export function createElementNodePropertyBinding(state: any, el: any, attribute: string, expression: string): void {
  const name = attribute.startsWith("@")
    ? attribute.slice(1)
    : attribute.replace("bind-", "").replace(/([-]{1}[a-z]{1})+/g, (s) => s.slice(1).toUpperCase());

  const fn = compileExpression(expression);

  watch(wrapTryCatch(expression, fn), (v: any) => setProperty(el, name, v));
}

function wrapTryCatch(exp: string, fn: AnyFunction) {
  return () => {
    try {
      const v = fn();
      return unref(v);
    } catch (e) {
      console.log("Error: " + exp, e);
    }
  };
}

////// DOM updates

export function setProperty(el: Element, property: string, value: any): void {
  el[property] = unref(value);
}

export function setEventHandler(el: EventTarget, eventName: string, handler: AnyFunction, options?: any): void {
  el.addEventListener(
    eventName,
    (event: { stopPropagation: () => any; preventDefault: () => any }) => {
      options.stop && event.stopPropagation();
      options.prevent && event.preventDefault();
      handler(event);
    },
    options
  );
}

export function setClassName(el: Element, classNames: string, value: any): void {
  for (const cls of classNames.split(".")) {
    el.classList.toggle(cls, value);
  }
}

export function setStyle(el: HTMLElement, key: string, value: any): void {
  el.style[key] = value;
}

export function setText(el: Text, text: any): void {
  el.textContent = String(text);
}

export function setAttribute(el: Element, attribute: string, value: boolean): void {
  if (!validAttribute.test(attribute)) {
    return;
  }

  if (typeof value === "boolean" && value === false) {
    el.removeAttribute(attribute);
    return;
  }

  el.setAttribute(attribute, String(value));
}

export function injectCssIntoElement(el: Element, href: string, id: string, condition: boolean) {
  const parent = el.shadowRoot || document.head;

  if (false === condition || (id && parent.querySelector(`[id="css-${id}"]`))) {
    return;
  }

  const tag = document.createElement("link");
  tag.rel = "stylesheet";
  tag.href = href;

  if (id) {
    tag.id = "css-" + id;
  }

  parent.appendChild(tag);
}

export function injectScriptIntoElement(el: Element, src: string, id: string, condition: boolean) {
  const parent = el.shadowRoot || document.head;

  if (false === condition || (id && parent.querySelector(`[id="js-${id}"]`))) {
    return;
  }

  const tag = document.createElement("script");
  tag.src = src;

  if (id) {
    tag.id = "js-" + id;
  }

  parent.append(tag);
}

export function traverseDom(dom: any, visitor: AnyFunction) {
  const stack = [dom];

  while (stack.length) {
    const next = stack.pop();

    if (next.childNodes?.length) {
      stack.push(...Array.from(next.childNodes));
    }

    visitor(next, next[Attributes] || getAttributes(next));
  }
}

export const Attributes = Symbol("@@attr");
export function applyAttributes(element: Element, attributes?: Attribute[]) {
  attributes ||= element[Attributes];

  if (!attributes) {
    return;
  }

  for (const attr of attributes) {
    setAttribute(element, attr[0], attr[1]);
  }
}

export function materialize(node: any, context: { ns?: any } = {}): Element | Text | DocumentFragment | Comment {
  // text
  if (typeof node === "string") {
    return document.createTextNode(node);
  }

  const [t, attributes = 0, children = []] = node;

  // comment
  // node = ['!', 'text']
  if ("!" === t) {
    return document.createComment(attributes);
  }

  // document or template
  // node = ['#d', 0, [...]]
  // node = ['template', 0, [...]]
  if ("#" === t || "template" === t) {
    const isDocument = "#" === t;
    const doc = isDocument ? document.createDocumentFragment() : document.createElement("template");
    const container = isDocument ? doc : (doc as HTMLTemplateElement).content;

    if (Array.isArray(children) && children.length) {
      for (const next of children) {
        container.append(materialize(next, context));
      }
    }

    if (!isDocument) {
      doc[Attributes] = attributes;
      applyAttributes(doc as HTMLTemplateElement);
    }

    return doc;
  }

  // element
  // node = [tag, attrs, children]
  if ("svg" === t) {
    context.ns = "http://www.w3.org/2000/svg";
  }

  const el = context.ns ? document.createElementNS(context.ns, t) : document.createElement(t);
  el[Attributes] = attributes;
  applyAttributes(el);

  // single child, a text node
  if (typeof children === "string") {
    el.append(materialize([children]));
  }

  // a mix of nodes and string
  if (Array.isArray(children) && children.length) {
    for (const next of children) {
      el.append(materialize(next, context));
    }
  }

  if ("svg" === t) {
    context.ns = "";
  }

  return el;
}
