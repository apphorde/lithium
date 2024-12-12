import { isRef, unref, markAsReactive } from "@lithium/reactive";
import {
  isElement,
  setClassName,
  setEventHandler,
  setProperty,
  setStyle,
  traverseDom,
} from "../layer-1/dom.js";
import { compileExpression } from "../layer-1/expressions.js";
import { plugins } from "../layer-0/plugin.js";
import { watch } from "../layer-0/reactive.js";
import { AnyFunction, Attribute } from "../layer-0/types.js";

plugins.use({
  applyAttribute($el, node, attribute, value) {
    if (!isElement(node)) {
      return;
    }

    if (attribute.charAt(0) === ":" || attribute.startsWith("bind-")) {
      createElementNodePropertyBinding($el.state, node, attribute, value);
    }
  },
});

export function createElementNodeBindings(
  state: any,
  el: Element,
  attributes: Array<Attribute>
): void {
  for (const attr of attributes) {


    if (attribute.startsWith(".style.") || attribute.startsWith("style-")) {
      createElementNodeStyleBinding(state, el, attribute, value);
      continue;
    }

    if (attribute === "ref") {
      createElementNodeRefBinding(state, el, attribute, value);
      continue;
    }
  }
}



export function createElementNodeRefBinding(
  state: any,
  el: any,
  _attribute: any,
  expression: string
): void {
  const ref = expression.trim();

  if (isRef(state[ref])) {
    markAsReactive(el);
    state[ref].value = el;
  }
}


export function createElementNodeStyleBinding(
  state: any,
  el: any,
  attribute: string,
  expression: string
): void {
  const style = attribute.replace(".style.", "").replace("style-", "");
  const fn = compileExpression(expression);
  watch(wrapTryCatch(expression, fn), (v: any) => setStyle(el, style, v));
}

export function createElementNodePropertyBinding(
  state: any,
  el: any,
  attribute: string,
  expression: string
): void {
  const name = attribute.startsWith("@")
    ? attribute.slice(1)
    : dashToCamelCase(attribute.replace("bind-", ""));

  const fn = compileExpression(expression);

  watch(wrapTryCatch(expression, fn), (v: any) => setProperty(el, name, v));
}

function dashToUpperCase(s: string) {
  return s.slice(1).toUpperCase();
}

export function dashToCamelCase(s: string) {
  return s.replace(/([-]{1}[a-z]{1})+/g, dashToUpperCase);
}
