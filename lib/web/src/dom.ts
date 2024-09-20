import type { AnyFunction } from "./types";
import { unref } from "@lithium/reactive";

const validAttribute = /^[a-zA-Z_][a-zA-Z0-9\-_:.]*$/;

export class DOM {
  static attachHandler(el: EventTarget, eventName: string, handler: AnyFunction, options?: any): void {
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

  static loadScript(el: Element, src: string, id: string, condition: boolean) {
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
}
