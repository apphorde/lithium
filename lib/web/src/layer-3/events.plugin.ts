import { isElement, setEventHandler } from "../layer-1/dom.js";
import { compileExpression } from "../layer-1/expressions.js";
import { plugins } from "../layer-0/plugin.js";

const eventFlags = ["capture", "once", "passive", "stop", "prevent"];

/* dead
export function defineEvents(eventNames: any): EventEmitter {
  const el = getCurrentInstance().element;

  if (isElement(el)) {
    for (const event of eventNames) {
      defineEventOnElement(el, event);
    }
  }

  return emitEvent.bind(null, el);
}

export function emitEvent(
  element: Element,
  eventName: string,
  detail: any
): void {
  const event = new CustomEvent(eventName, { detail });
  element.dispatchEvent(event);
}

export function defineEventOnElement(el: Element, name: string): void {
  const property = "on" + name.toLowerCase();
  if (!el.hasOwnProperty(property)) {
    Object.defineProperty(el, property, { value: null });
  }
}

// -- dead
*/

plugins.use({
  applyAttribute($el, node, attribute, value) {
    if (!isElement(node)) {
      return;
    }

    if (attribute.charAt(0) === "@" || attribute.startsWith("on-")) {
      createElementNodeEventBinding($el.state, node, attribute, value);
    }
  },
});

export function createElementNodeEventBinding(
  _state: any,
  el: Element,
  attribute: string,
  expression: string
): void {
  const normalized = attribute.startsWith("@")
    ? attribute.slice(1)
    : attribute.replace("on-", "");
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
