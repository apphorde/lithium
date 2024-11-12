import type { ComponentDefinitions } from "./types";

export interface MountOptions {
  props?: any;
  parent?: any;
}

export function mount(element: DocumentFragment | Element | string, def: ComponentDefinitions, options?: MountOptions) {
  if (typeof element === "string") {
    element = document.querySelector(element);
  }

  if (!element) {
    throw new Error("Target element not found");
  }

  const { setup = noop, template, shadowDom } = def;
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

const eventFlags = ["capture", "once", "passive", "stop", "prevent"];

interface Attribute {
  name: string;
  value: string;
}

export function createBindings(state: any, element: Element | Text, attributes: Array<Attribute>): void {
  if (element.nodeType === element.TEXT_NODE) {
    createTextNodeBinding(<Text>element);
    return;
  }

  if (isElement(element)) {
    createElementNodeBindings(state, <Element>element, attributes);
    return;
  }
}

export function createTextNodeBinding(el: Text): void {
  const text = el.textContent;

  if (text.includes("${") || text.includes("{{")) {
    const expression =
      "`" + text.replace(/\{\{([\s\S]+?)}}/g, (_: any, inner: string) => "${ " + inner.trim() + " }") + "`";
    el.textContent = "";
    const fn = compileExpression(expression);
    watch(wrapTryCatch(expression, fn), (v?: any) => setText(el, v));
  }
}

export function createElementNodeBindings(state: any, el: Element, attributes: Array<Attribute>): void {
  if (!(Array.isArray(attributes) && attributes.length)) return;

  for (const attr of attributes) {
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

    if (attribute.startsWith(".class.") || attribute.startsWith("class-")) {
      createElementNodeClassBinding(state, el, attribute, expression);
      continue;
    }

    if (attribute.startsWith(".style.") || attribute.startsWith("style-")) {
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

export function createElementNodeRefBinding(state: any, el: any, _attribute: any, expression: string): void {
  const ref = expression.trim();

  if (isRef(state[ref])) {
    markAsReactive(el);
    state[ref].value = el;
  }
}

export function createElementNodeClassBinding(state: any, el: any, attribute: string, expression: string): void {
  const classNames = attribute.replace(".class.", "").replace("class-", "");
  const fn = compileExpression(expression);
  watch(wrapTryCatch(expression, fn), (v?: any) => setClassName(el, classNames, v));
}

export function createElementNodeStyleBinding(state: any, el: any, attribute: string, expression: string): void {
  const style = attribute.replace(".style.", "").replace("style-", "");
  const fn = compileExpression(expression);
  watch(wrapTryCatch(expression, fn), (v: any) => setStyle(el, style, v));
}

export function createElementNodePropertyBinding(state: any, el: any, attribute: string, expression: string): void {
  const name = attribute.startsWith("@") ? attribute.slice(1) : dashToCamelCase(attribute.replace("bind-", ""));

  const fn = compileExpression(expression);

  watch(wrapTryCatch(expression, fn), (v: any) => setProperty(el, name, v));
}

function dashToUpperCase(s: string) {
  return s.slice(1).toUpperCase();
}

export function dashToCamelCase(s: string) {
  return s.replace(/([-]{1}[a-z]{1})+/g, dashToUpperCase);
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
  for (const cls of classNames.split(".").filter(Boolean)) {
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

export function injectCssIntoElement(el: Element | DocumentFragment, href: string, id: string, condition: boolean) {
  const parent = el["shadowRoot"] || document.head;

  if ((condition !== undefined && !condition) || (id && parent.querySelector(`[id="css-${id}"]`))) {
    return;
  }

  const tag = document.createElement("link");
  tag.rel = "stylesheet";
  tag.href = href;

  if (id) {
    tag.id = "css-" + id;
  }

  parent.append(tag);
}

export function injectScriptIntoElement(el: Element | DocumentFragment, src: string, id: string, condition: boolean) {
  const parent = el["shadowRoot"] || document.head;

  if ((condition !== undefined && !condition) || (id && parent.querySelector(`[id="js-${id}"]`))) {
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

/**
 * materialize(['text'])
 * materialize(['!', 'comment'])
 * materialize(['#', 0, ['document-fragment-children']])
 * materialize(['div', [['attr', 'value']], ['children']])
 */
export function materialize(node: any, context: { ns?: any } = {}): Element | Text | DocumentFragment | Comment {
  // text
  if (typeof node === "string") {
    return document.createTextNode(node);
  }

  const [t, attributes = 0, children = []] = node;

  // comment
  if ("!" === t) {
    return document.createComment(attributes);
  }

  // document or template
  // node = ['#', 0, [...]]
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

function isElement(node: any): node is Element {
  return node && node.nodeType === node.ELEMENT_NODE;
}
