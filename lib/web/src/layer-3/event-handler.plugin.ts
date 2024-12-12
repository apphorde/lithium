import { setEventHandler } from "../layer-1/dom.js";
import { compileExpression } from "../layer-1/expressions.js";
import { plugins } from "../layer-0/plugin.js";

const eventFlags = ["capture", "once", "passive", "stop", "prevent"];

plugins.use({
  applyAttribute(_$el, node: Element, attribute: string, value: string) {
    if (attribute.charAt(0) === "@" || attribute.startsWith("on-")) {
      createEventBinding(node, attribute, value);
    }
  },
});

export function createEventBinding(
  el: Element,
  attribute: string,
  expression: string
): void {
  const normalized = attribute.startsWith("@")
    ? attribute.slice(1)
    : attribute.replace("on-", "");

  const [eventName, ...flags] = normalized.split(".");
  const exec = compileExpression(expression, ["$event"]);
  const options = {};

  for (const flag of eventFlags) {
    options[flag] = flags.includes(flag);
  }

  setEventHandler(
    el,
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
