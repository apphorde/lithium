import { signal } from "@li3/reactive";
import {
  getCurrentContext,
  onVisitAttribute,
  RuntimeContext,
} from "@li3/runtime";

onVisitAttribute(
  ($el: RuntimeContext, node: Element, attribute: string, refName: string) => {
    if (attribute === "ref") {
      attachElementRef($el, node, refName.trim());
    }
  }
);

export function attachElementRef(
  $el: RuntimeContext,
  node: Element,
  refName: string
) {
  if (!$el.state[refName]) {
    $el.state[refName] = signal(null, { shallow: true });
  }

  $el.state[refName].value = node;
}

export function templateRef(name: string) {
  return (getCurrentContext().state[name] ||= signal(null, { shallow: true }));
}
