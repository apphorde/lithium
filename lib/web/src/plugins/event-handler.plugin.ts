import { setEventHandler } from "../internal-api/dom.js";
import { compileExpression } from "../internal-api/expressions.js";
import { plugins } from "../internal-api/plugin.js";
import { RuntimeInternals } from "../internal-api/types";

const eventFlags = ["capture", "once", "passive", "stop", "prevent"];

plugins.use({
  applyAttribute($el, node: Element, attribute: string, value: string) {
    if (attribute.startsWith("on-")) {
      createEventBinding($el, node, attribute.replace("on-", ""), value);
    }
  },
});

export function createEventBinding(
  $el: RuntimeInternals,
  element: Element,
  attribute: string,
  expression: string
): void {
  const [eventName, ...flags] = attribute.split(".");
  const exec = compileExpression($el, expression, ["$event"]);
  const options = {};

  for (const flag of eventFlags) {
    options[flag] = flags.includes(flag);
  }

  setEventHandler(
    element,
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
