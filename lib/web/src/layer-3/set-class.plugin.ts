import { isElement, setClassName } from "../layer-1/dom.js";
import { compileExpression, wrapTryCatch } from "../layer-1/expressions.js";
import { plugins } from "../layer-0/plugin.js";
import { watch } from "../layer-0/reactive.js";

plugins.use({
  applyAttribute(_, node, attribute, value) {
    if (attribute.startsWith(".class.") || attribute.startsWith("class-")) {
      createClassBinding(
        node,
        attribute.replace(".class.", "").replace("class-", ""),
        value
      );
    }
  },
});

export function createClassBinding(
  el: any,
  classNames: string,
  expression: string
): void {
  const fn = compileExpression(expression);

  watch(wrapTryCatch(expression, fn), (v?: any) =>
    setClassName(el, classNames, v)
  );
}
