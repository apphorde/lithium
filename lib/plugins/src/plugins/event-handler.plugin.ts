import { setEventHandler } from "@li3/dom";
import { compileExpression } from "@li3/scope";
import { Plugins, RuntimeContext } from "@li3/runtime";

Plugins.use({
  attribute($el, node: Element, attribute: string, value: string) {
    if (attribute.startsWith("on-")) {
      createEventBinding($el, node, attribute.replace("on-", ""), value);
    }
  },
});

export function createEventBinding($el: RuntimeContext, element: Element, attribute: string, expression: string): void {
  const [eventName, ...flags] = attribute.split(".");
  const exec = compileExpression($el, expression, ["$event", "$flags"]);
  const options = {};

  for (const flag of flags) {
    options[flag] = flags.includes(flag);
  }

  setEventHandler(
    element,
    eventName,
    (e: Event) => {
      try {
        exec(e, flags);
      } catch (e) {
        console.error("event failed", expression, e);
      }
    },
    options
  );
}
