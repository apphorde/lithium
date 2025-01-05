import { setText } from "../layer-1/dom.js";
import { compileExpression, wrapTryCatch } from "../layer-1/expressions.js";
import { plugins } from "../layer-0/plugin.js";
import { watch } from "../layer-0/reactive.js";
import { RuntimeInternals } from "../layer-0/types";

plugins.use({
  createElement($el: RuntimeInternals, node: Text) {
    if (node.nodeType !== node.TEXT_NODE) {
      return;
    }

    createTextNodeBinding($el, node);
  },
});

function createTextNodeBinding($el: RuntimeInternals, node: Text) {
  const text = String(node.textContent);
  if (!(text.includes("${") || text.includes("{{"))) {
    return;
  }

  node.textContent = "";

  const expression =
    "`" +
    text.replace(
      /\{\{([\s\S]+?)}}/g,
      (_: any, inner: string) => "${ " + inner.trim() + " }"
    ) +
    "`";

  const fn = compileExpression($el, expression);
  watch(wrapTryCatch(expression, fn), (v?: any) => setText(node, v));
}
