import { setText } from '@li3/dom';
import { computedEffect } from '@li3/scope';
import { Plugins, type RuntimeContext } from '@li3/runtime';

Plugins.use({
  element($el: RuntimeContext, node: Text) {
    if (node.nodeType !== node.TEXT_NODE) {
      return;
    }

    if (!node.parentElement?.hasAttribute('literal')) {
      createTextNodeBinding($el, node);
    }
  },
});

export function createTextNodeBinding($el: RuntimeContext, node: Text) {
  const text = String(node.textContent);

  if (!(text.includes('${') || text.includes('{{'))) {
    return;
  }

  node.textContent = '';

  const expression =
    '`' + text.replace(/\{\{([\s\S]+?)}}/g, (_: any, inner: string) => '${ ' + inner.trim() + ' }') + '`';

  computedEffect($el, expression, (v: string) => setText(node, v));
}
