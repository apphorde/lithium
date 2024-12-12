import { plugins } from "../layer-0/plugin.js";
import { isRef } from "../layer-0/reactive.js";
import { markAsReactive } from "@lithium/reactive";

plugins.use({
  applyAttribute($el, node: Element, attribute: string, refName: string) {
    if (attribute !== "ref") {
      return;
    }

    setElementRefValue($el, node, refName);
  },
});

function setElementRefValue($el, node, refName) {
  if (isRef($el.state[refName])) {
    markAsReactive(node);
    $el.state[refName].value = node;
  }
}
