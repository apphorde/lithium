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

    const newNodes = await resize(context, list.length);
    updateStateOfCacheEntry(context, list);

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

async function resize(context: Context, newLength: number) {
  const { nodeCache } = context;

  if (newLength === nodeCache.length) {
    return;
  }

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

  let index = nodeCache.length;
  const length = newLength - 1;
  const { indexName } = context;
  const newElements = document.createDocumentFragment();
  const nodes = await Promise.all(
    Array(newLength - nodeCache.length)
      .fill(0)
      .map(() => createCacheEntry(context))
  );

  for (const entry of nodes) {
    nodeCache.push(entry);
    newElements.append(...entry.nodes);
    const state = entry.$el.state;
    state[indexName] = index;
    state.$first = index === 0;
    state.$last = index === length;
    state.$odd = index % 2 === 1;
    state.$even = index % 2 === 0;
    index++;
  }

  return newElements;
}

async function createCacheEntry(context: Context): Promise<NodeCacheEntry> {
  const { $el, template, itemName, indexName } = context;

  function setup() {
    defineProps([itemName, indexName, "$first", "$last", "$odd", "$even"]);
  }

  const itemFragment = document.createDocumentFragment();
  const childState = await mount(
    itemFragment,
    { setup, template },
    { parent: $el }
  );

  return { nodes: Array.from(itemFragment.childNodes), $el: childState };
}

function updateStateOfCacheEntry(context: Context, list: any[]) {
  const { nodeCache, itemName } = context;
  let index = 0;

  for (const item of list) {
    nodeCache[index++].$el.state[itemName] = item;
  }
}
