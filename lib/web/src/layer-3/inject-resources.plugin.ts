import { plugins } from "../layer-0/plugin.js";
import type { RuntimeInternals } from "../layer-0/types.js";

plugins.use({
  appendDom($el: RuntimeInternals) {
    const { element, stylesheets, scripts } = $el;

    for (const [a, b, c] of stylesheets) {
      injectCssIntoElement(element, a, b, c);
    }

    for (const [a, b, c] of scripts) {
      injectScriptIntoElement(element, a, b, c);
    }
  },
});

export function injectCssIntoElement(
  el: Element | DocumentFragment,
  href: string,
  id: string,
  condition: boolean
) {
  const parent = el["shadowRoot"] || document.head;

  if (
    (condition !== undefined && !condition) ||
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

  parent.append(tag);
}

export function injectScriptIntoElement(
  el: Element | DocumentFragment,
  src: string,
  id: string,
  condition: boolean
) {
  const parent = el["shadowRoot"] || document.head;

  if (
    (condition !== undefined && !condition) ||
    (id && parent.querySelector(`[id="js-${id}"]`))
  ) {
    return;
  }

  const tag = document.createElement("script");
  tag.src = src;

  if (id) {
    tag.id = "js-" + id;
  }

  parent.append(tag);
}
