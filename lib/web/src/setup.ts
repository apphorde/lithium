import { Ref, unref, isRef } from "@lithium/reactive";
import type { AnyFunction, RuntimeInfo } from "./types.js";
import { DOM } from "./dom.js";

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const domParser = new DOMParser();
const stack: RuntimeInfo[] = [];

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

export type EventEmitterFn = (event: string, detail: any) => void;
export function defineEvents(eventNames: any): EventEmitterFn {
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
      return;
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
  const tree = mapTree(dom.body, (element) => {
    if (element.nodeType === element.TEXT_NODE) {
      return (element as Text).textContent;
    }

    if (element.nodeType === element.ELEMENT_NODE) {
      return [element.nodeName.toLowerCase(), getAttributes(element as Element), []];
    }
  });

  return ["#", "html", tree];
}

function mapTree(tree: ChildNode | Document | DocumentFragment, mapper: (node: ChildNode) => any) {
  return Array.from(tree.childNodes).map((next) => {
    const parsed = mapper(next);

    if (next.childNodes?.length) {
      parsed[2] = mapTree(next, mapper);
    }

    return parsed || "";
  });
}

function getAttributes(node: Element) {
  return Array.from(node.attributes).map((a) => [a.localName, a.value]);
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
    createState();
    createDom();
    reactive.unsuspend();
    reactive.check();

    if ($el.destroy) {
      ($el.element as any).__destroy = $el.destroy;
    }

    if ($el.init) {
      await $el.init();
    }
  } catch (error) {
    console.log("Failed to initialize component!", this, error);
  }

  stack.pop();

  return $el;
}

export function createState(): void {
  const $el = getCurrentInstance();
  const componentData = $el.setup($el, $el.element);
  $el.state = $el.reactive.watchDeep({ ...componentData, ...$el.state });
  $el.stateKeys = Object.keys($el.state);
  $el.stateArgs = $el.stateKeys.map((key) => $el.state[key]);
}

export function createDom(): void {
  const { element, template, shadowDom, stylesheets, scripts, state } = getCurrentInstance();

  const dom = DOM.materialize(template, (el, attrs) => createBindings(state, el, attrs), {});

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

function ensureDisplayBlock(name: string) {
  if (!document.head.querySelector(`[id="ce-${name}"]`)) {
    const css = document.createElement("style");
    css.id = "ce-" + name;
    css.innerText = name.toLowerCase() + "{display:block}";
    document.head.append(css);
  }
}

function parseText(expression: string, args: string[] = []): AnyFunction {
  const parsed = domParser.parseFromString(expression, "text/html");
  const code = parsed.body.innerText.trim();

  return (expression.startsWith("await") ? AsyncFunction : Function)(...args, `return ${code}`);
}

export function compileExpression(expression: string, context: any, args: string[] = []): AnyFunction {
  const { stateKeys, stateArgs } = getCurrentInstance();
  return parseText(expression, [...stateKeys, ...args]).bind(context, ...stateArgs);
}

/////////// Runtime API

const eventFlags = ["capture", "once", "passive", "stop", "prevent"];

export function createBindings(state: any, element: Element | Text, attributes: any): void {
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
    const fn = compileExpression(expression, state);
    watch(wrapTryCatch(expression, fn), (v?: any) => DOM.setText(el, v));
  }
}

export function createElementNodeBindings(state: any, el: Element, attrs: any): void {
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

export function createElementNodeEventBinding(context: any, el: any, attribute: string, expression: any): void {
  const normalized = attribute.startsWith("@") ? attribute.slice(1) : attribute.replace("on-", "");
  const [eventName, ...flags] = normalized.split(".");
  const exec = compileExpression(expression, context, ["$event"]);
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

export function createElementNodeClassBinding(context: any, el: any, attribute: string, expression: any): void {
  const classNames = attribute.replace(".class.", "").replace("class-", "");
  const fn = compileExpression(expression, context);
  watch(wrapTryCatch(expression, fn), (v?: any) => DOM.setClassName(el, classNames, v));
}

export function createElementNodeStyleBinding(context: any, el: any, attribute: string, expression: any): void {
  const style = attribute.replace(".style.", "");
  const fn = compileExpression(expression, context);
  watch(wrapTryCatch(expression, fn), (v: any) => DOM.setStyle(el, style, v));
}

export function createElementNodePropertyBinding(context: any, el: any, attribute: string, expression: any): void {
  const name = attribute.startsWith("@")
    ? attribute.slice(1)
    : attribute.replace("bind-", "").replace(/([-]{1}[a-z]{1})+/g, (s) => s.slice(1).toUpperCase());

  const fn = compileExpression(expression, context);

  watch(wrapTryCatch(expression, fn), (v: any) => DOM.setProperty(el, name, v));
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
