import { ReactiveContext, Ref, unref, isRef } from "@lithium/reactive";

export interface RuntimeInfo {
  shadowDom: ShadowRootInit | boolean;
  reactive: ReactiveContext;
  element: Element;
  props: any;
  stylesheets: string[];
  scripts: string[];
  $state: any;
  $stateKeys: string[];
  $stateArgs: any[];
  template: any[];
  setup: Function;
  init: VoidFunction | null;
  destroy: VoidFunction | null;
}

interface RuntimeDefinitions {
  setup: Function;
  template: any[];
  shadowDom: any;
}

type AnyFunction = (...args: any) => any;

const eventFlags = ["capture", "once", "passive", "stop", "prevent"];
const validAttribute = /^[a-zA-Z_][a-zA-Z0-9\-_:.]*$/;
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const domParser = new DOMParser();
const stack: RuntimeInfo[] = [];

export const noop = () => {};
export const DefineComponent = Symbol("@@def");

export function createComponent(name: string, def: RuntimeDefinitions): void {
  if (customElements.get(name)) {
    customElements.get(name)![DefineComponent] = def;
    return;
  }

  class Component extends HTMLElement {
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

export function mount(element, definitions, props?) {
  if (typeof element === "string") {
    element = document.querySelector(element);
  }

  const { setup, template, shadowDom = false } = definitions;
  const $el = {
    shadowDom,
    element,
    props,
    setup,
    stylesheets: [],
    scripts: [],
    nodes: template,
    $state: {},
    $stateKeys: [],
    $stateArgs: [],
    init: null,
    destroy: null,
    reactive: new ReactiveContext(),
  };

  queueMicrotask(() => Runtime.init($el));

  return $el;
}

export class DOM {
  static attachHandler(
    el: EventTarget,
    eventName: string,
    handler: AnyFunction,
    options?: any
  ): void {
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

  static emitEvent(element: Element, eventName: string, detail: any): void {
    const event = new CustomEvent(eventName, { detail });
    element.dispatchEvent(event);
  }

  static setProperty(el: Element, property: string, value: any): void {
    el[property] = unref(value);
  }

  static setClassName(el: Element, classNames: string, value: any): void {
    for (const cls of classNames.split(".")) {
      el.classList.toggle(cls, value);
    }
  }

  static setStyle(el: HTMLElement, key: string, value: any): void {
    el.style[key] = value;
  }

  static setText(el: Text, text: any): void {
    el.textContent = String(text);
  }

  static defineEvent(el: Element, name: string): void {
    const property = "on" + name.toLowerCase();
    let handler: AnyFunction = el[property];

    Object.defineProperty(el, property, {
      get() {
        return handler;
      },
      set(v) {
        handler = v;
      },
    });
  }

  static compileExpression(
    expression: string,
    args: string[] = []
  ): AnyFunction {
    const parsed = domParser.parseFromString(expression, "text/html");
    const code = parsed.body.innerText.trim();

    return (expression.startsWith("await") ? AsyncFunction : Function)(
      ...args,
      `return ${code}`
    );
  }

  static materialize(
    node: any,
    visitor: (el: any, attr?: any) => void,
    context?: { ns?: any }
  ): Element | Text | DocumentFragment | Comment {
    // text
    if (typeof node === "string") {
      const txt = document.createTextNode(node);
      visitor(txt);
      return txt;
    }

    const [t, attributes = 0, children = []] = node;

    // document
    // node = ['#d', 0, [...]]
    if ("#" === t) {
      const doc = document.createDocumentFragment();

      if (Array.isArray(children) && children.length) {
        doc.append(
          ...children.map((next) => DOM.materialize(next, visitor, context))
        );
      }

      return doc;
    }

    // comment
    // node = ['!', 'text']
    if ("!" === t) {
      return document.createComment(attributes);
    }

    // element
    // node = [tag, attrs, children]
    if ("svg" === t) {
      context.ns = "http://www.w3.org/2000/svg";
    }

    const el = context.ns
      ? document.createElementNS(context.ns, t)
      : document.createElement(t);
    visitor(el, attributes);

    if (attributes) {
      for (const attr of attributes) {
        DOM.setAttribute(el, attr[0], attr[1]);
      }
    }

    // single child, a text node
    if (typeof children === "string") {
      el.append(DOM.materialize([children], visitor));
    }

    // a mix of nodes and string
    if (Array.isArray(children) && children.length) {
      el.append(...children.map((n) => DOM.materialize(n, visitor, context)));
    }

    if ("svg" === t) {
      context.ns = "";
    }

    return el;
  }

  static setAttribute(el: Element, attribute: string, value: boolean): void {
    if (!validAttribute.test(attribute)) {
      return;
    }

    if (typeof value === "boolean" && value === false) {
      el.removeAttribute(attribute);
      return;
    }

    el.setAttribute(attribute, String(value));
  }

  static loadCss(el: Element, href: string, id: string, condition: boolean) {
    const parent = el.shadowRoot || document.head;

    if (
      false === condition ||
      (id && parent.querySelector(`[id="css-${id}"]`))
    ) {
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

  static loadScript(el: Element, href: string, id: string, condition: boolean) {
    const parent = el.shadowRoot || document.head;

    if (
      false === condition ||
      (id && parent.querySelector(`[id="js-${id}"]`))
    ) {
      return;
    }

    const tag = document.createElement("script");
    tag.src = src;

    if (id) {
      tag.id = "js-" + id;
    }

    const { shadowDom, element } = getCurrentInstance();
    if (shadowDom && element.shadowRoot) {
      element.shadowRoot.appendChild(tag);
    } else {
      parent.append(tag);
    }
  }
}

export class Runtime {
  static async init($el: RuntimeInfo): Promise<void> {
    stack.push($el);

    try {
      const { reactive } = $el;
      ensureDisplayBlock($el.element.nodeName);
      reactive.suspend();
      Runtime.createInstance();
      Runtime.createDom();
      reactive.unsuspend();
      reactive.check();

      if ($el.destroy) {
        element.__destroy = $el.destroy;
      }

      if ($el.init) {
        await $el.init();
      }
    } catch (error) {
      console.log("Failed to initialize component!", this, error);
    }

    stack.pop();
  }

  static createInstance(): void {
    // API
    // import { onInit, onDestroy, computed, defineEvents, defineProps, ref, watch, loadCss, loadScript } from 'lithium';
    const $el = getCurrentInstance();
    const componentData = $el.setup($el, $el.element);
    $el.$state = $el.reactive.watchDeep({ ...componentData, ...$el.$state });
    $el.$stateKeys = Object.keys($el.$state);
    $el.$stateArgs = $el.$stateKeys.map((key) => $el.$state[key]);

    if ($el.props) {
      Object.assign($el.element, $el.props);
    }
  }

  static createDom(): void {
    const { element, nodes, shadowDom, stylesheets, scripts, $state } =
      getCurrentInstance();
    const dom = DOM.materialize(
      nodes,
      (el, attrs) => Runtime.createBindings($state, el, attrs),
      {}
    );

    element.innerHTML = "";

    if (!shadowDom) {
      element.append(dom);
    } else {
      element.attachShadow(shadowDom as ShadowRootInit);
      element.shadowRoot.append(dom);
    }

    for (const [a, b, c] of stylesheets) {
      DOM.loadCss(element, a, b, c);
    }

    for (const [a, b, c] of scripts) {
      DOM.loadScript(element, a, b, c);
    }
  }

  static compileExpression(expression: string, context: any): AnyFunction {
    const { $stateKeys, $stateArgs } = getCurrentInstance();
    return DOM.compileExpression(expression, $stateKeys).bind(
      context,
      ...$stateArgs
    );
  }

  static createBindings(
    state: any,
    element: Element | Text,
    attributes: any
  ): void {
    if (element.nodeType === element.TEXT_NODE) {
      Runtime.createTextNodeBinding(state, <Text>element);
      return;
    }

    if (element.nodeType === element.ELEMENT_NODE) {
      Runtime.createElementNodeBindings(state, <Element>element, attributes);
      return;
    }
  }

  static createTextNodeBinding(context: any, el: Text): void {
    const text = el.textContent;
    if (text.includes("${") || text.includes("{{")) {
      const expression =
        "`" +
        text.replace(
          /\{\{([\s\S]+?)}}/g,
          (_: any, inner: string) => "${ " + inner.trim() + " }"
        ) +
        "`";
      el.textContent = "";
      const fn = Runtime.compileExpression(expression, context);
      watch(wrapTryCatch(expression, fn), (v?: any) => DOM.setText(el, v));
    }
  }

  static createElementNodeBindings(
    context: any,
    el: Element,
    attrs: any
  ): void {
    for (const attr of attrs) {
      const attribute = attr[0].trim();
      const expression = attr[1].trim();

      if (attribute.charAt(0) === ":" || attribute.startsWith("bind-")) {
        Runtime.createElementNodePropertyBinding(
          context,
          el,
          attribute,
          expression
        );
        continue;
      }

      if (attribute.charAt(0) === "@" || attribute.startsWith("on-")) {
        Runtime.createElementNodeEventBinding(
          context,
          el,
          attribute,
          expression
        );
        continue;
      }

      if (attribute.startsWith(".class.")) {
        Runtime.createElementNodeClassBinding(
          context,
          el,
          attribute,
          expression
        );
        continue;
      }

      if (attribute.startsWith(".style.")) {
        Runtime.createElementNodeStyleBinding(
          context,
          el,
          attribute,
          expression
        );
        continue;
      }

      if (attribute === "ref") {
        Runtime.createElementNodeRefBinding(context, el, attribute, expression);
        continue;
      }
    }
  }

  static createElementNodeEventBinding(
    context: any,
    el: any,
    attribute: string,
    expression: any
  ): void {
    const normalized = attribute.startsWith("@")
      ? attribute.slice(1)
      : attribute.replace("on-", "");
    const [eventName, ...flags] = normalized.split(".");
    const { $stateKeys, $stateArgs } = getCurrentInstance();
    const exec = DOM.compileExpression(expression, [
      ...$stateKeys,
      "$event",
    ]).bind(context, ...$stateArgs);
    const options = {};

    for (const flag of eventFlags) {
      options[flag] = flags.includes(flag);
    }

    DOM.attachHandler(
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

  static createElementNodeRefBinding(
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

  static createElementNodeClassBinding(
    context: any,
    el: any,
    attribute: string,
    expression: any
  ): void {
    const classNames = attribute.replace(".class.", "").replace("class-", "");
    const fn = Runtime.compileExpression(expression, context);
    watch(wrapTryCatch(expression, fn), (v?: any) =>
      DOM.setClassName(el, classNames, v)
    );
  }

  static createElementNodeStyleBinding(
    context: any,
    el: any,
    attribute: string,
    expression: any
  ): void {
    const style = attribute.replace(".style.", "");
    const fn = Runtime.compileExpression(expression, context);
    watch(wrapTryCatch(expression, fn), (v: any) => DOM.setStyle(el, style, v));
  }

  static createElementNodePropertyBinding(
    context: any,
    el: any,
    attribute: string,
    expression: any
  ): void {
    const name = attribute.startsWith("@")
      ? attribute.slice(1)
      : attribute
          .replace("bind-", "")
          .replace(/([-]{1}[a-z]{1})+/g, (s) => s.slice(1).toUpperCase());

    const fn = Runtime.compileExpression(expression, context);

    watch(wrapTryCatch(expression, fn), (v: any) =>
      DOM.setProperty(el, name, v)
    );
  }
}

//////////////////// public api

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

export function defineEvents(
  eventNames: any
): (event: string, detail: any) => void {
  const el = getCurrentInstance().element;

  for (const event of eventNames) {
    DOM.defineEvent(el, event);
  }

  return (e, d) => DOM.emitEvent(el, e, d);
}

export function defineProps(definitions: {}): any {
  const keys = !Array.isArray(definitions)
    ? Object.keys(definitions)
    : definitions;
  const $el = getCurrentInstance();
  const { element, $state } = $el;
  const props = {};

  for (const property of keys) {
    const initialValue = element.hasOwnProperty(property)
      ? element[property]
      : element.getAttribute(property);
    const $ref = $el.reactive.ref(initialValue);
    $state[property] = $ref;
    props[property] = $ref;

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
  const tree = mapTree(dom.body, (element) => {
    if (element.nodeType === element.TEXT_NODE) {
      return (element as Text).textContent;
    }

    if (element.nodeType === element.ELEMENT_NODE) {
      return [
        element.nodeName.toLowerCase(),
        getAttributes(element as Element),
        [],
      ];
    }
  });

  return ["#", "html", tree];
}

//////////////////// end of public api

function getAttributes(node: Element) {
  return Array.from(node.attributes).map((a) => [a.localName, a.value]);
}

function mapTree(
  tree: ChildNode | Document | DocumentFragment,
  mapper: (node: ChildNode) => any
) {
  return Array.from(tree.childNodes).map((next) => {
    const parsed = mapper(next);

    if (next.childNodes?.length) {
      parsed[2] = mapTree(next, mapper);
    }

    return parsed || "";
  });
}

function wrapTryCatch(exp: string, fn: AnyFunction) {
  return () => {
    try {
      const v = fn();
      return unref(v);
    } catch (e) {
      console.log(exp, e);
    }
  };
}

function ensureDisplayBlock(name: string) {
  if (!document.head.querySelector(`[id="ce-${name}"]`)) {
    const css = document.createElement("style");
    css.id = "ce-" + name;
    css.innerText = name.toLowerCase() + "{display:block}";
    document.head.append(css);
  }
}
