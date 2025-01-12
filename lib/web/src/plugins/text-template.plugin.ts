import { setText } from "../internal-api/dom.js";
import { compileExpression, wrapTryCatch } from "../internal-api/expressions.js";
import { plugins } from "../internal-api/plugin.js";
import { watch } from "../component-api/setup.js";
import { RuntimeInternals } from "../internal-api/types";

plugins.use({
  createElement($el: RuntimeInternals, node: Text) {
    if (node.nodeType !== node.TEXT_NODE) {
      return;
    }

    if (!node.parentElement.hasAttribute("literal")) {
      createTextNodeBinding($el, node);
    }
  },
});

function createTextNodeBinding($el: RuntimeInternals, node: Text) {
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
