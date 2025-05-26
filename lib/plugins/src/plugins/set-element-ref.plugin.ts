import { signal } from "@li3/reactive";
import { getCurrentContext, getOption, Plugins, RuntimeContext } from "@li3/runtime";

Plugins.use({
  attribute($el: RuntimeContext, node: Element, attribute: string, refName: string) {
    if (attribute === "ref") {
      setElementRefValue($el, node, refName.trim());
    }
  },
});

export function setElementRefValue($el: RuntimeContext, node: Element, refName: string) {
  if ($el.state[refName]) {
    $el.state[refName].value = node;
    return;
  }

  if (getOption("debugEnabled")) {
    console.warn("Ref not found in state: " + refName, $el.state);
  }
}

export function templateRef(name: string) {
  return (getCurrentContext().state[name] = signal(null, { shallow: true }));
}
