import { plugins } from "../layer-0/plugin.js";
import { getCurrentInstance } from "../layer-0/stack.js";
import { mount } from "../layer-2/mount.js";
import { defineProps } from "../layer-1/props.js";
import { unref } from "../layer-0/reactive.js";
import type { RuntimeInternals } from "../layer-0/types.js";

plugins.use({
  appendDom($el: RuntimeInternals) {
    const { element } = $el;
    const templates: HTMLTemplateElement[] = Array.from(
      (element["shadowRoot"] || element).querySelectorAll("template[for]")
    );

    for (const t of templates) {
      templateForOf(t, $el);
    }
  },
});

export async function templateForOf(
  template: HTMLTemplateElement,
  $el?: RuntimeInternals
) {
  $el ||= getCurrentInstance();
  const expression = template.getAttribute("for");
  const [iteration, source] = expression.split("of").map((s) => s.trim());
  const [key, index] = iteration.includes("[")
    ? iteration
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
    : [iteration, "index"];

  const previousNodes = [];

  function remove() {
    for (const next of previousNodes) {
      next.remove();
    }

    previousNodes.length = 0;
  }

  async function add(list) {
    const frag = await repeatTemplate($el, template, list, key, index);
    previousNodes.push(...Array.from(frag.childNodes));
    template.parentNode.insertBefore(frag, template);
  }

  async function updateDom(list) {
    list = unref(list);
    remove();

    if (!template.parentNode || !Array.isArray(list)) {
      return;
    }

    add(list);
  }

  // TODO compile source to an expression
  $el.reactive.watch(() => $el.state[source], updateDom);
}

async function repeatTemplate(
  parent: RuntimeInternals,
  template: HTMLTemplateElement,
  items: any[],
  itemName: string,
  indexName: string
) {
  function setup() {
    defineProps([itemName, indexName, "$first", "$last", "$odd", "$even"]);
  }

  const fragment = document.createDocumentFragment();
  const results = items.map(async (item, index) => {
    const itemFragment = document.createDocumentFragment();
    await mount(
      itemFragment,
      {
        setup,
        template,
      },
      {
        parent,
        props: {
          [itemName]: item,
          [indexName]: index,
          $first: index === 0,
          $last: index === items.length - 1,
          $odd: index % 2 === 1,
          $even: index % 2 === 0,
        },
      }
    );

    fragment.append(itemFragment);
  });

  await Promise.all(results);

  return fragment;
}
