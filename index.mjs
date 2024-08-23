const eventFlags = ["capture", "once", "passive", "stop", "prevent"];
const validAttribute = /^[a-zA-Z_][a-zA-Z0-9\-_:.]*$/;
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const domParser = new DOMParser();
const stack = [];

export const noop = () => {};
export const DefineComponent = Symbol("@@def");

export function createComponent(name, { setup, template }) {
  if (customElements.get(name)) {
    customElements.get(name)[DefineComponent] = { name, setup, template };
    return;
  }

  class Component extends HTMLElement {
    connectedCallback() {
      const { setup, template } = Component[DefineComponent];
      const $el = {
        element: this,
        componentSetup: setup,
        nodes: template,
        $state: {},
        init: null,
        destroy: null,
        reactive: new Reactive(),
      };

      this.$el = $el;
      queueMicrotask(() => Runtime.init($el));
    }

    disconnectedCallback() {
      if (!this.isConnected && this.$el.destroy) {
        queueMicrotask(this.$el.destroy);
      }
    }
  }

  Component[DefineComponent] = { name, setup, template };
  customElements.define(name, Component);
}

export class Reactive {
  #watchers;
  #suspended;

  constructor() {
    this.#watchers = [];
    this.#suspended = false;
    this.check = this.check.bind(this);
  }

  check() {
    if (this.#suspended) return;

    for (const w of this.#watchers) {
      w();
    }
  }

  watch(exec, effect) {
    let lastValue;
    let fn;

    if (!effect) {
      fn = exec;
    } else {
      fn = function () {
        const value = exec();

        if (value !== lastValue && !Number.isNaN(value)) {
          lastValue = value;
          effect(value);
        }
      };
    }

    this.#watchers.push(fn);
  }

  ref(initialValue) {
    const target = { value: initialValue };

    Object.defineProperty(target, "__isRef", { value: true, enumerable: false, configurable: false });
    Object.defineProperty(target, "toString", {
      value: function () {
        return String(this.value);
      },
      enumerable: false,
      configurable: false,
    });

    return this.watchDeep(target);
  }

  watchObject(context, callback) {
    if (context.__w) {
      return context;
    }

    callback ||= this.check;
    const scope = this;
    Object.defineProperty(context, "__w", { value: true, enumerable: false, configurable: false });

    return new Proxy(context, {
      set(target, p, value) {
        if (typeof value === "object" && !value.__w) {
          value = scope.watchDeep(value, callback);
        }

        target[p] = value;
        callback();
        return true;
      },
    });
  }

  watchDeep(context, callback) {
    // wrapping HTML elements with proxies leads to sad panda
    if (context.__w || context instanceof HTMLElement) {
      return context;
    }

    callback ||= this.check;
    const values = Object.entries(context);

    for (const [key, next] of values) {
      if (typeof next === "object" && next !== null) {
        context[key] = this.watchObject(next, callback);
      }
    }

    return this.watchObject(context, callback);
  }

  suspend() {
    this.#suspended = true;
  }

  unsuspend() {
    this.#suspended = false;
  }

  static isRef(t) {
    return typeof t !== "object" ? false : t && t.__isRef;
  }

  static unref(v) {
    return Reactive.isRef(v) ? v.value : v;
  }
}

export class DOM {
  static attachHandler(el, eventName, handler, options) {
    el.addEventListener(
      eventName,
      (event) => {
        options.stop && event.stopPropagation();
        options.prevent && event.preventDefault();
        handler(event);
      },
      options
    );
  }

  static emitEvent(element, event, detail) {
    return element.dispatchEvent(new CustomEvent(event, { detail }));
  }

  static setProperty(el, property, value) {
    el[property] = Reactive.unref(value);
  }

  static setClassName(el, classNames, value) {
    for (const cls of classNames.split(".")) {
      el.classList.toggle(cls, value);
    }
  }

  static setStyle(el, style, value) {
    el.style[style] = value;
  }

  static setText(el, text) {
    el.textContent = String(text);
  }

  static defineEvent(el, name) {
    let handler;

    Object.defineProperty(el, "on" + name.toLowerCase(), {
      get() {
        return handler;
      },
      set(v) {
        handler = v;
      },
    });
  }

  static compileExpression(expression, args = []) {
    const parsed = domParser.parseFromString(expression, "text/html");
    const code = parsed.body.innerText.trim();

    return (expression.startsWith("await") ? AsyncFunction : Function)(...args, `return ${code}`);
  }

  static materialize(node, visitor, context) {
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
        doc.append(...children.map((next) => DOM.materialize(next, visitor, context)));
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

    const el = context.ns ? document.createElementNS(context.ns, t) : document.createElement(t);
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

  static setAttribute(el, attribute, value) {
    if (!validAttribute.test(attribute)) {
      return;
    }

    if (typeof value === "boolean" && value === false) {
      el.removeAttribute(attribute);
      return;
    }

    el.setAttribute(attribute, String(value));
  }
}

export class Runtime {
  static async init($el) {
    stack.push($el);

    try {
      const { reactive } = $el;
      ensureDisplayBlock($el.element.nodeName);
      reactive.suspend();
      Runtime.createInstance();
      Runtime.createDom();
      reactive.unsuspend();
      reactive.check();

      if ($el.init) {
        $el.init();
      }
    } catch (error) {
      console.log("Failed to initialize component!", this, error);
    }

    stack.pop();
  }

  static createInstance() {
    // API
    // import { onInit, onDestroy, computed, defineEvents, defineProps, ref, watch, loadCss, loadScript } from 'lithium';
    const $el = getCurrentInstance();
    const componentData = $el.componentSetup($el, $el.element);
    $el.$state = $el.reactive.watchDeep({ ...componentData, ...$el.$state });
    $el.$stateKeys = Object.keys($el.$state);
    $el.$stateArgs = $el.$stateKeys.map((key) => $el.$state[key]);
  }

  static createDom() {
    const { element, nodes, $state } = getCurrentInstance();
    const dom = DOM.materialize(nodes, (el, attrs) => Runtime.createBindings($state, el, attrs), {});
    element.innerHTML = "";
    element.append(dom);
  }

  static compileExpression(expression, context) {
    const { $stateKeys, $stateArgs } = getCurrentInstance();
    return DOM.compileExpression(expression, $stateKeys).bind(context, ...$stateArgs);
  }

  static createBindings(state, element, attributes) {
    if (element.nodeType === element.TEXT_NODE) {
      Runtime.createTextNodeBinding(state, element);
      return;
    }

    if (element.nodeType === element.ELEMENT_NODE) {
      Runtime.createElementNodeBindings(state, element, attributes);
      return;
    }
  }

  static createTextNodeBinding(context, el) {
    const text = el.textContent;
    if (text.includes("${") || text.includes("{{")) {
      const expression = "`" + text.replace(/\{\{([\s\S]+?)}}/g, (_, inner) => "${ " + inner.trim() + " }") + "`";
      el.textContent = "";
      const fn = Runtime.compileExpression(expression, context);
      watch(wrapTryCatch(expression, fn), (v) => DOM.setText(el, v));
    }
  }

  static createElementNodeBindings(context, el, attrs) {
    for (const attr of attrs) {
      const attribute = attr[0].trim();
      const expression = attr[1].trim();

      if (attribute.charAt(0) === ":") {
        Runtime.createElementNodePropertyBinding(context, el, attribute, expression);
        continue;
      }

      if (attribute.charAt(0) === "@") {
        Runtime.createElementNodeEventBinding(context, el, attribute, expression);
        continue;
      }

      if (attribute.startsWith(".class.")) {
        Runtime.createElementNodeClassBinding(context, el, attribute, expression);
        continue;
      }

      if (attribute.startsWith(".style.")) {
        Runtime.createElementNodeStyleBinding(context, el, attribute, expression);
        continue;
      }

      if (attribute === "ref") {
        Runtime.createElementNodeRefBinding(context, el, attribute, expression);
        continue;
      }
    }
  }

  static createElementNodeEventBinding(context, el, attribute, expression) {
    const [eventName, ...flags] = attribute.slice(1).split(".");
    const { $stateKeys, $stateArgs } = getCurrentInstance();
    const exec = DOM.compileExpression(expression, [...$stateKeys, "$event"]).bind(context, ...$stateArgs);
    const options = {};

    for (const flag of eventFlags) {
      options[flag] = flags.includes(flag);
    }

    DOM.attachHandler(
      el,
      eventName,
      (e) => {
        try {
          exec(e);
        } catch (e) {
          console.error("event failed", expression, e);
        }
      },
      options
    );
  }

  static createElementNodeRefBinding(context, el, _attribute, expression) {
    const ref = expression.trim();

    if (Reactive.isRef(context[ref])) {
      context[ref].value = el;
    }
  }

  static createElementNodeClassBinding(context, el, attribute, expression) {
    const classNames = attribute.replace(".class.", "");
    const fn = Runtime.compileExpression(expression, context);
    watch(wrapTryCatch(expression, fn), (v) => DOM.setClassName(el, classNames, v));
  }

  static createElementNodeStyleBinding(context, el, attribute, expression) {
    const style = attribute.replace(".style.", "");
    const fn = Runtime.compileExpression(expression, context);
    watch(wrapTryCatch(expression, fn), (v) => DOM.setStyle(el, style, v));
  }

  static createElementNodePropertyBinding(context, el, attribute, expression) {
    const name = attribute.slice(1);
    const fn = Runtime.compileExpression(expression, context);

    watch(wrapTryCatch(expression, fn), (v) => DOM.setProperty(el, name, v));
  }
}

//////////////////// public api

export function getCurrentInstance() {
  return stack[stack.length - 1];
}

export function loadCss(href, id, condition) {
  if (false === condition || (id && document.head.querySelector(`[id="css-${id}"]`))) {
    return;
  }

  const tag = document.createElement("link");
  tag.rel = "stylesheet";
  tag.href = href;

  if (id) {
    tag.id = "css-" + id;
  }

  // TODO attach to shadowRoot
  document.head.append(tag);
}

export function loadScript(src, id, condition) {
  if (false === condition || (id && document.head.querySelector(`[id="js-${id}"]`))) {
    return;
  }

  const tag = document.createElement("script");
  tag.src = src;

  if (id) {
    tag.id = "js-" + id;
  }

  // TODO attach to shadowRoot
  document.head.append(tag);
}

export function onInit(fn) {
  getCurrentInstance().init = fn;
}

export function onDestroy(fn) {
  getCurrentInstance().destroy = fn;
}

export function computed(fn) {
  const $ref = ref();
  watch(() => {
    const v = fn();
    if ($ref.value !== v) {
      $ref.value = v;
    }
  });

  return $ref;
}

export function defineEvents(eventNames) {
  const el = getCurrentInstance().element;

  for (const event of eventNames) {
    DOM.defineEvent(el, event);
  }

  return (e, d) => DOM.emitEvent(el, e, d);
}

export function defineProps(props) {
  const keys = !Array.isArray(props) ? Object.keys(props) : props;
  const $el = getCurrentInstance();
  const element = $el.element;
  const $state = $el.$state;

  for (const property of keys) {
    const $ref = ref(element[property]);
    $state[property] = $ref;

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
        return $el.$state[p].value;
      },
    }
  );
}

export function watch(expression, effect) {
  return getCurrentInstance().reactive.watch(expression, effect);
}

export function ref(value) {
  return getCurrentInstance().reactive.ref(value);
}

//////////////////// end of public api

function wrapTryCatch(exp, fn) {
  return () => {
    try {
      const v = fn();
      return Reactive.unref(v);
    } catch (e) {
      console.log(exp, e);
    }
  };
}

function ensureDisplayBlock(name) {
  if (!document.head.querySelector(`[id="ce-${name}"]`)) {
    const css = document.createElement("style");
    css.id = "ce-" + name;
    css.innerText = name.toLowerCase() + "{display:block}";
    document.head.append(css);
  }
}
