import { markAsReactive, isRef } from "@li3/reactive";
import { getOption, Plugins, RuntimeContext } from "@li3/runtime";

Plugins.use({
  attribute($el: RuntimeContext, node: Element, attribute: string, refName: string) {
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
