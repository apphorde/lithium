import { mount, defineProps } from '@li3/browser';
import { getOption, Plugins, type RuntimeContext } from '@li3/runtime';
import { computedEffect } from '@li3/scope';

const VM = Symbol('@@FOR');

interface NodeCacheEntry {
  $el: RuntimeContext;
  nodes: ChildNode[];
}

interface TemplateForRuntimeContext {
  nodeCache: NodeCacheEntry[];
  itemName: string;
  indexName: string;
  $el: RuntimeContext;
  template: HTMLTemplateElement;
}

Plugins.use({
  dom($el: RuntimeContext, dom: DocumentFragment | HTMLElement) {
    const templates: HTMLTemplateElement[] = Array.from(dom.querySelectorAll('template[for]'));

    for (const t of templates) {
      templateForOf(t, $el);
    }
  },
});

export function templateForOf(template: HTMLTemplateElement, $el: RuntimeContext) {
  const nodeCache: NodeCacheEntry[] = [];
  const expression = template.getAttribute('for');
  const [iteration, source] = expression.split(' of ').map((s) => s.trim());

  if (!source || !iteration) {
    if (getOption('debugEnabled')) {
      throw new Error('TemplateFor directive requires an expression with "of" keyword. Example: for="item of items"');
    }

    return;
  }

  const [itemName, indexName] = iteration.includes('[')
    ? iteration
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
    : [iteration, 'index'];

  const context: TemplateForRuntimeContext = { itemName, indexName, nodeCache, $el, template };

  function onListChange(list: any[]) {
    if (!template.parentNode || !Array.isArray(list)) {
      resize(context, 0);
      return;
    }

    if (!getOption('cachedTemplateFor')) {
      resize(context, 0);
    }

    const newNodes = resize(context, list.length, list);
    updateStateOfCacheEntries(context, list);

    if (!newNodes) {
      return;
    }

    if (!nodeCache.length) {
      template.parentNode.insertBefore(newNodes, template);
      return;
    }

    const lastNode = findLastNode(nodeCache) || template;
    template.parentNode.insertBefore(newNodes, lastNode);

    if (getOption('debugEnabled')) {
      template[VM] = nodeCache;
    }
  }

  queueMicrotask(() => computedEffect($el, source, onListChange));
}

function findLastNode(nodeCache: NodeCacheEntry[]) {
  let index = nodeCache.length - 1;

  while (index >= 0) {
    const nodes = nodeCache[index].nodes;
    const last = nodes[nodes.length - 1];

    if (last?.isConnected) {
      return last;
    }

    index--;
  }
}

function resize(context: TemplateForRuntimeContext, newLength: number, list?: any[]) {
  const { nodeCache } = context;

  if (newLength === nodeCache.length) {
    return;
  }

  // remove excess of nodes
  if (newLength < nodeCache.length) {
    const nodesToRemove = nodeCache.slice(newLength);
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

  Array(newLength - nodeCache.length)
    .fill(0)
    .forEach((_, at) => {
      const index = baseLength + at;
      const props = {
        [itemName]: list[index],
        [indexName]: index,
        $first: index === 0,
        $last: index === maxLength,
        $odd: index % 2 === 1,
        $even: index % 2 === 0,
      };

      const entry = createCacheEntry(context, props);

      nodeCache.push(entry);
      newElements.append(...entry.nodes);
    });

  return newElements;
}

function createCacheEntry(context: TemplateForRuntimeContext, props: any): NodeCacheEntry {
  const { $el, template, itemName, indexName } = context;
  const contextProperties = [itemName, indexName, '$first', '$last', '$odd', '$even'];

  function setup() {
    defineProps(contextProperties);
  }

  const itemFragment = document.createDocumentFragment();
  const childState = mount(itemFragment, { setup, template }, { parent: $el, props });

  return { nodes: Array.from(itemFragment.childNodes), $el: childState };
}

function updateStateOfCacheEntries(context: TemplateForRuntimeContext, list: any[]) {
  const { nodeCache, itemName } = context;
  let index = 0;

  for (const item of list) {
    nodeCache[index].$el.state[itemName].value = item;
    index++;
  }
}
