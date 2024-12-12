import type {
  AnyFunction,
  Attribute,
  RuntimeInternals,
} from "../layer-0/types.js";
import { getCurrentInstance } from "../layer-0/stack.js";
import { plugins } from "../layer-0/plugin.js";
import { unref } from "../layer-0/reactive.js";

const validAttribute = /^[a-zA-Z_][a-zA-Z0-9\-_:.]*$/;

export function setProperty(el: Element, property: string, value: any): void {
  el[property] = unref(value);
}

export function setEventHandler(
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

export function setClassName(
  el: Element,
  classNames: string,
  value: any
): void {
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

export function setAttribute(
  el: Element,
  attribute: string,
  value: boolean
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

export function getAttributes(node: Element) {
  return node.attributes
    ? Array.from(node.attributes).map((a) => [a.localName, a.value])
    : [];
}

export function isElement(node: any): node is Element {
  return node && node.nodeType === node.ELEMENT_NODE;
}

export function isFragment(node: any): node is DocumentFragment {
  return node && node.nodeType === node.DOCUMENT_FRAGMENT_NODE;
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

function mapTree<
  T extends ChildNode | Document | DocumentFragment | HTMLTemplateElement
>(tree: T, mapper: (node: T) => any) {
  const nodes: T[] = (tree["content"] || tree).childNodes;
  return Array.from(nodes)
    .map((next) => {
      const parsed = mapper(next);
      const nodes: T[] = parsed
        ? (next["content"] || next).childNodes
        : undefined;
      if (nodes && nodes.length) {
        parsed[2] = mapTree(next, mapper);
      }

      return parsed;
    })
    .filter((node) => node !== undefined);
}

/**
 * materialize(['text'])
 * materialize(['!', 'comment'])
 * materialize(['#', 0, ['document-fragment-children']])
 * materialize(['div', [['attr', 'value']], ['children']])
 */
export function materialize(
  node: any,
  context: { ns?: any } = {}
): Element | Text | DocumentFragment | Comment {
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
    const doc = isDocument
      ? document.createDocumentFragment()
      : document.createElement("template");
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

  const el = context.ns
    ? document.createElementNS(context.ns, t)
    : document.createElement(t);
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

export function domReady() {
  return new Promise((next) => {
    if (document.readyState == "complete") {
      next(null);
      return;
    }

    window.addEventListener("DOMContentLoaded", () => next(null));
  });
}

export function clearElement(element: Element | DocumentFragment) {
  if (isFragment(element)) {
    element.childNodes.forEach((e) => e.remove());
    return;
  }

  element.innerHTML = "";
}

export function createDom($el: RuntimeInternals): void {
  $el ||= getCurrentInstance();
  const { element, template, shadowDom, state } = $el;
  let dom: any = template;

  if (Array.isArray(template)) {
    dom = materialize(template);
  }

  if (template["content"]) {
    dom = template["content"].cloneNode(true);
  }

  plugins.apply("createDom", [$el, dom]);

  traverseDom(dom, (node, attributes) => {
    plugins.apply("createElement", [$el, node]);

    if (!isElement(node) || !(Array.isArray(attributes) && attributes.length)) {
      return;
    }

    for (const attr of attributes) {
      const attribute = attr[0].trim();
      const value = attr[1].trim();
      plugins.apply("applyAttribute", [$el, node, attribute, value]);
    }
  });

  const previousContent = Array.from(element.childNodes);

  if (!shadowDom) {
    clearElement(element);
  }

  if (!shadowDom || isFragment(element)) {
    element.append(dom);
    element.querySelector("slot")?.append(...previousContent);
  } else {
    element.attachShadow(shadowDom as ShadowRootInit);
    element.shadowRoot.append(dom);
  }

  plugins.apply("appendDom", [$el]);
}
