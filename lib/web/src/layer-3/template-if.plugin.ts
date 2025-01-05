import { plugins } from "../layer-0/plugin.js";
import { getCurrentInstance } from "../layer-0/stack.js";
import { compileExpression } from "../layer-1/expressions.js";
import { mount } from "../layer-2/mount.js";
import type { RuntimeInternals } from "../layer-0/types.js";

plugins.use({
  appendDom($el: RuntimeInternals) {
    const { element } = $el;
    const templates: HTMLTemplateElement[] = Array.from(
      (element["shadowRoot"] || element).querySelectorAll("template[if]")
    );

    for (const t of templates) {
      templateIf(t, $el);
    }
  },
});

export async function templateIf(
  template: HTMLTemplateElement,
  $el?: RuntimeInternals
) {
  $el ||= getCurrentInstance();

  const expression = template.getAttribute("if");
  const getter = compileExpression($el, expression);
  const previousNodes = [];

  function remove() {
    for (const next of previousNodes) {
      next.parentNode && next.remove();
    }

    previousNodes.length = 0;
  }

  async function add() {
    const fragment = document.createDocumentFragment();
    await mount(fragment, { template }, { parent: $el });
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
