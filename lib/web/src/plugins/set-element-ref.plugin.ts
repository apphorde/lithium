import { getOption } from "../internal-api/options";
import { plugins } from "../internal-api/plugin.js";
import { markAsReactive, isRef } from "@li3/reactive";
import { RuntimeContext } from "../internal-api/types";

plugins.use({
  applyAttribute($el: RuntimeContext, node: Element, attribute: string, refName: string) {
    if (attribute === "ref") {
      setElementRefValue($el, node, refName.trim());
    }
  },
});

export function setElementRefValue($el: RuntimeContext, node: Element, refName: string) {
  if (isRef($el.state[refName])) {
    markAsReactive(node);
    $el.state[refName].value = node;
    return;
  }

  if (getOption("debugEnabled")) {
    console.warn("Ref not found in state: " + refName, $el.state);
  }
}
