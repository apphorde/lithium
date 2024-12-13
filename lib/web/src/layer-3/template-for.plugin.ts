import { plugins } from "../layer-0/plugin.js";
import { getCurrentInstance } from "../layer-0/stack.js";
import { mount } from "../layer-2/mount.js";
import { defineProps } from "../layer-1/props.js";
import { unref } from "../layer-0/reactive.js";
import type { RuntimeInternals } from "../layer-0/types.js";

interface NodeCacheEntry {
  $el: RuntimeInternals;
  nodes: ChildNode[];
}

interface Context {
  nodeCache: NodeCacheEntry[];
  itemName: string;
  indexName: string;
  $el: RuntimeInternals;
  template: HTMLTemplateElement;
}

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

export function templateForOf(
  template: HTMLTemplateElement,
  $el?: RuntimeInternals
) {
  $el ||= getCurrentInstance();
  const nodeCache: NodeCacheEntry[] = [];
  const expression = template.getAttribute("for");
  const [iteration, source] = expression.split("of").map((s) => s.trim());
  const [itemName, indexName] = iteration.includes("[")
    ? iteration
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
    : [iteration, "index"];

  const context: Context = { itemName, indexName, nodeCache, $el, template };

  async function onListChange(list: any[]) {
    list = unref(list);

    if (!template.parentNode || !Array.isArray(list)) {
      resize(context, 0);
      return;
    }

    const newNodes = await resize(context, list.length, list);
    updateStateOfCacheEntries(context, list);

    if (!newNodes) {
      return;
    }

    if (!nodeCache.length) {
      template.parentNode.insertBefore(newNodes, template);
      return;
    }

    const lastCacheEntry = nodeCache[nodeCache.length - 1].nodes;
    const lastNode = lastCacheEntry[lastCacheEntry.length - 1];
    template.parentNode.insertBefore(newNodes, lastNode);
    $el.reactive.check();
  }

  // TODO compile source to an expression
  $el.reactive.watch(() => $el.state[source], onListChange);
}

async function resize(context: Context, newLength: number, list?: any[]) {
  const { nodeCache } = context;

  if (newLength === nodeCache.length) {
    return;
  }

  // remove excess of nodes
  if (newLength < nodeCache.length) {
    const nodesToRemove = nodeCache.slice(nodeCache.length - newLength);
    nodeCache.length = newLength;

    for (const cacheEntry of nodesToRemove) {
      for (const node of cacheEntry.nodes) {
        node.remove();
      }
    }

    return;
  }

  // add nodes to cache and return them
  const maxLength = newLength - 1;
  const baseLength = nodeCache.length;
  const { indexName, itemName } = context;
  const newElements = document.createDocumentFragment();

  await Promise.all(
    Array(newLength - nodeCache.length)
      .fill(0)
      .map(async (_, at) => {
        const index = baseLength + at;
        const props = {
          [itemName]: list[index],
          [indexName]: index,
          $first: index === 0,
          $last: index === maxLength,
          $odd: index % 2 === 1,
          $even: index % 2 === 0,
        };

        const entry = await createCacheEntry(context, props);

        nodeCache.push(entry);
        newElements.append(...entry.nodes);
      })
  );

  return newElements;
}

async function createCacheEntry(
  context: Context,
  props: any
): Promise<NodeCacheEntry> {
  const { $el, template, itemName, indexName } = context;

  function setup() {
    defineProps([itemName, indexName, "$first", "$last", "$odd", "$even"]);
  }

  const itemFragment = document.createDocumentFragment();
  const childState = await mount(
    itemFragment,
    { setup, template },
    { parent: $el, props }
  );

  return { nodes: Array.from(itemFragment.childNodes), $el: childState };
}

function updateStateOfCacheEntries(context: Context, list: any[]) {
  const { nodeCache, itemName } = context;
  let index = 0;

  for (const item of list) {
    nodeCache[index++].$el.state[itemName].value = item;
  }
}
