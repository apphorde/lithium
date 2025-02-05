import { setText } from "../internal-api/dom.js";
import { compileExpression, wrapTryCatch } from "../internal-api/expressions.js";
import { plugins } from "../internal-api/plugin.js";
import { watch } from "../component-api/setup.js";
import { RuntimeContext } from "../internal-api/types";

plugins.use({
  initElement($el: RuntimeContext, node: Text) {
    if (node.nodeType !== node.TEXT_NODE) {
      return;
    }

    if (!node.parentElement?.hasAttribute("literal")) {
      createTextNodeBinding($el, node);
    }
  },
});

export function createTextNodeBinding($el: RuntimeContext, node: Text) {
  const text = String(node.textContent);
  if (!(text.includes("${") || text.includes("{{"))) {
    return;
  }

  node.textContent = "";

  const expression =
    "`" + text.replace(/\{\{([\s\S]+?)}}/g, (_: any, inner: string) => "${ " + inner.trim() + " }") + "`";

  const fn = compileExpression($el, expression);
  watch(wrapTryCatch(expression, fn), (v?: any) => setText(node, v));
}
