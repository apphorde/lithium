import { setClassName } from '@li3/dom';
import { compileExpression, wrapTryCatch } from '@li3/scope';
import { Plugins, RuntimeContext } from '@li3/runtime';
import { watch } from '@li3/browser';

Plugins.use({
  attribute($el, node, attribute, value) {
    if (attribute.startsWith('class-')) {
      createClassBinding($el, node, attribute.replace('class-', ''), value);
    }
  },
});

export function createClassBinding(
  $el: RuntimeContext,
  element: Element,
  classNames: string,
  expression: string,
): void {
  const fn = compileExpression($el, expression);

  watch(wrapTryCatch(expression, fn), (v?: any) => setClassName(element, classNames, v));
}
