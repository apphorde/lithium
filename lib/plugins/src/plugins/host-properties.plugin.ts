import { isElement } from "@li3/dom";
import { Plugins } from "../../../runtime/src/runtime/plugin.js";
import { RuntimeContext } from "@li3/runtime";

RuntimeContext.use({
  hostClasses: [],
});

Plugins.use({
  dom($el: RuntimeContext) {
    applyHostAttributes($el);
  },
});

export function applyHostAttributes($el: RuntimeContext) {
  if (!isElement($el.element)) return;

  const hostClasses = $el.hostClasses.join(" ").trim();
  if (hostClasses) {
    $el.element.className += " " + hostClasses;
  }
}
