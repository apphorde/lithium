import { setClassName } from '@li3/dom';
import { Plugins, type RuntimeContext } from '@li3/runtime';
import { computedEffect } from '@li3/scope';

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
  computedEffect($el, expression, (v?: any) => setClassName(element, classNames, v));
}
