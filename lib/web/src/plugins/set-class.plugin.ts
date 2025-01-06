import { setClassName } from "../internal-api/dom.js";
import {
  compileExpression,
  wrapTryCatch,
} from "../internal-api/expressions.js";
import { plugins } from "../internal-api/plugin.js";
import { watch } from "../internal-api/reactive.js";
import { RuntimeInternals } from "../internal-api/types";

plugins.use({
  applyAttribute($el, node, attribute, value) {
    if (attribute.startsWith(".class.") || attribute.startsWith("class-")) {
      createClassBinding(
        $el,
        node,
        attribute.replace(".class.", "").replace("class-", ""),
        value
      );
    }
  },
});

export function createClassBinding(
  $el: RuntimeInternals,
  element: Element,
  classNames: string,
  expression: string
): void {
  const fn = compileExpression($el, expression);

  watch(wrapTryCatch(expression, fn), (v?: any) =>
    setClassName(element, classNames, v)
  );
}
