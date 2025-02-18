import { Plugins, type RuntimeContext } from '@li3/runtime';
import { mount } from '@li3/browser';
import { computedEffect } from '@li3/scope';

Plugins.use({
  dom($el: RuntimeContext) {
    const templates: HTMLTemplateElement[] = Array.from($el.element.querySelectorAll('template[if]'));

    for (const t of templates) {
      templateIf(t, $el);
    }
  },
});

export async function templateIf(template: HTMLTemplateElement, $el: RuntimeContext) {
  const previousNodes = [];

  function remove() {
    for (const next of previousNodes) {
      next.parentNode && next.remove();
    }

    previousNodes.length = 0;
  }

  function add() {
    const fragment = document.createDocumentFragment();
    mount(fragment, { template }, { parent: $el });
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

  const expression = template.getAttribute('if');
  computedEffect($el, expression, updateDom);
}
