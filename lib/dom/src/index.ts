export type AnyFunction = (...args: any) => any;
export interface Attribute {
  name: string;
  value: string;
}

const validAttribute = /^[a-zA-Z_][a-zA-Z0-9\-_:.]*$/;

export function setProperty(el: Element, property: string, value: any): void {
  el[property] = value;
}

export function setEventHandler(el: EventTarget, eventName: string, handler: AnyFunction, options?: any): void {
  el.addEventListener(
    eventName,
    function (event: Event) {
      options.stop && event.stopPropagation();
      options.prevent && event.preventDefault();
      handler(event);
    },
    options,
  );
}

export function setClassName(el: Element, classNames: string, value: any): void {
  for (const cls of classNames.split('.').filter(Boolean)) {
    el.classList.toggle(cls, value);
  }
}

export function setStyle(el: any, key: string, value: any): void {
  el.style[key] = value;
}

export function setText(el: Text, text: any): void {
  el.textContent = String(text);
}

export function setAttribute(el: Element, attribute: string, value: boolean): void {
  if (!validAttribute.test(attribute)) {
    return;
  }

  if (typeof value === 'boolean' && value === false) {
    el.removeAttribute(attribute);
    return;
  }

  el.setAttribute(attribute, String(value));
}

export function traverseDom(dom: any, visitor: AnyFunction) {
  const stack = [dom];

  while (stack.length) {
    const next = stack.pop();

    if (next.childNodes?.length) {
      stack.push(...Array.from(next.childNodes));
    }

    visitor(next, getAttributes(next));
  }
}

export function getAttributes(node: Element) {
  return node.attributes ? Array.from(node.attributes).map((a) => [a.localName, a.value]) : [];
}

export function getAttribute(node: Element, name: string) {
  return isElement(node) ? node.getAttribute(name.toLowerCase()) : null;
}

export function isElement(node: any): node is Element {
  return node && node.nodeType === node.ELEMENT_NODE;
}

export function isFragment(node: any): node is DocumentFragment {
  return node && node.nodeType === node.DOCUMENT_FRAGMENT_NODE;
}

export function tpl(text: string) {
  const template = document.createElement('template');
  template.innerHTML = text;
  return template;
}

export function domReady(fn?) {
  if (document.readyState === 'complete') {
    return fn ? fn() : Promise.resolve(null);
  }

  return new Promise((next) => {
    window.addEventListener('DOMContentLoaded', () => {
      fn && fn();
      next(null);
    });
  });
}

export function clearElement(element: Element | DocumentFragment) {
  if (isFragment(element)) {
    element.childNodes.forEach((e) => e.remove());
    return;
  }

  element.innerHTML = '';
}

export function defineEventOnElement(el: Element, name: string): void {
  const property = 'on' + name.toLowerCase();
  if (!el.hasOwnProperty(property)) {
    Object.defineProperty(el, property, { value: null });
  }
}

export function emitEvent(element: Element, eventName: string, detail: any): void {
  const event = new CustomEvent(eventName, { detail });
  element.dispatchEvent(event);
}

export function mapContentToSlots(content: Array<ChildNode>, element: Element | DocumentFragment) {
  const slots: Record<string, HTMLSlotElement> = {};
  element.querySelectorAll('slot').forEach((slot) => (slots[slot.name || 'default'] = slot));

  const frag = document.createDocumentFragment();
  frag.append(...content);

  frag.querySelectorAll('[slot]').forEach((element) => {
    const slotName = element.getAttribute('slot');
    if (slots[slotName]) {
      slots[slotName].append(element);
    }
  });

  if (slots.default) {
    slots.default.append(frag);
  }
}
