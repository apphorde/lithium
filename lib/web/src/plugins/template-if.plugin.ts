import { plugins } from '../internal-api/plugin.js';
import { compileExpression } from '../internal-api/expressions.js';
import { mount } from '../component-api/custom-elements.js';
import type { RuntimeContext } from '../internal-api/types.js';

plugins.use({
  dom($el: RuntimeContext) {
    const templates: HTMLTemplateElement[] = Array.from($el.element.querySelectorAll('template[if]'));

    for (const t of templates) {
      templateIf(t, $el);
    }
  },
});

export async function templateIf(template: HTMLTemplateElement, $el: RuntimeContext) {
  const expression = template.getAttribute('if');
  const getter = compileExpression($el, expression);
  const previousNodes = [];
  let childContext;

  $el.reactive.watch(() => childContext && childContext.reactive.check());

  function remove() {
    for (const next of previousNodes) {
      next.parentNode && next.remove();
    }

    previousNodes.length = 0;
    childContext = null;
  }

  function add() {
    const fragment = document.createDocumentFragment();
    childContext = mount(fragment, { template }, { parent: $el });
    previousNodes.push(...Array.from(fragment.childNodes));
    template.parentNode.insertBefore(fragment, template);
  }

  function updateDom(value) {
    if (!template.parentNode || !value) {
      remove();
      return;
    }

    if (!previousNodes.length) {
      add();
    }
  }

  $el.reactive.watch(getter, updateDom);
}
