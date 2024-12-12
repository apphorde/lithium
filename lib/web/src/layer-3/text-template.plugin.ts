import { setText } from "../layer-1/dom.js";
import { compileExpression, wrapTryCatch } from "../layer-1/expressions.js";
import { plugins } from "../layer-0/plugin.js";
import { watch } from "../layer-0/reactive.js";

plugins.use({
  createElement(_el, node: Text) {
    if (node.nodeType !== node.TEXT_NODE) {
      return;
    }

    const text = String(node.textContent);
    if (!(text.includes("${") || text.includes("{{"))) {
      return;
    }

    const expression =
      "`" +
      text.replace(
        /\{\{([\s\S]+?)}}/g,
        (_: any, inner: string) => "${ " + inner.trim() + " }"
      ) +
      "`";

    node.textContent = "";
    const fn = compileExpression(expression);
    watch(wrapTryCatch(expression, fn), (v?: any) => setText(node, v));
  },
});
