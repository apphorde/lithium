import { setText } from "../layer-1/dom.js";
import { compileExpression, wrapTryCatch } from "../layer-1/expressions.js";
import { plugins } from "../layer-0/plugin.js";
import { watch } from "../layer-0/reactive.js";

plugins.use({
  createElement(node: Text) {
    if (node.nodeType !== node.TEXT_NODE) {
      return;
    }

    createTextNodeBinding(node);
  },
});

function createTextNodeBinding(node: Text) {
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

  const fn = compileExpression(expression);
  watch(wrapTryCatch(expression, fn), (v?: any) => setText(node, v));
}
