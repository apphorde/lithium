import { createFunction, createReadOnlyContext, linkTreeToContext } from './internals.js';
import { ref, computed, effect } from './reactivity.js';
import type { Signal } from './reactivity';

const isElement = (x: any): x is Element => x.nodeType === x.ELEMENT_NODE;
const isText = (x: any): x is Text => x.nodeType === x.TEXT_NODE;

export function applyRules(node: Node, context: any) {
  if (isText(node)) {
    if (node.textContent.trim()) {
      bindText(node, context);
    }
    return;
  }

  if (!isElement(node)) {
    return;
  }

  for (const attr of Array.from(node.attributes)) {
    const name = attr.name;
    const value = attr.value.trim();

    for (const rule of rules) {
      if (rule.match(node, name, value)) {
        rule.exec(node, name, value, context);
        break;
      }
    }
  }
}

function bindText(node: Text, context: {}) {
  const template = node.textContent.trim();

  if (!template || !template.includes('{{')) return;

  const source = '`' + template.replace(/{{(.*?)}}/g, (_: any, exp: string) => '${' + exp.trim() + '}') + '`';

  effect(createFunction(source, context), (v: any) => setText(node, v));
}

const mappedProperties: Record<string, string> = {
  innerhtml: 'innerHTML',
  baseuri: 'baseURI',
  class: 'className',
};

function setClassName(el: Element, classNames: string, value: any): void {
  for (const cls of classNames.split('.').filter(Boolean)) {
    el.classList.toggle(cls, value);
  }
}

function setStyle(el: any, key: string, value: any): void {
  const toCamelCase = key.replace(/-([a-z])/g, (_: any, letter: string) => letter.toUpperCase());
  el.style[toCamelCase] = value;
}

function setText(el: Text, text: any): void {
  el.textContent = String(text !== undefined ? text : '');
}

function setProperty(node: any, key: string, value: any, modifiers: string[]): void {
  const mappedKey = mappedProperties[key] || key;

  if (modifiers.includes('bool')) {
    node.toggleAttribute(mappedKey, Boolean(value));
  } else {
    node[mappedKey] = value;
  }
}

const validAttribute = /^[a-zA-Z_][a-zA-Z0-9\-_:.]*$/;
function setAttribute(el: Element, attribute: string, value: boolean): void {
  if (!validAttribute.test(attribute)) {
    return;
  }

  if (typeof value === 'boolean' && value === false) {
    el.removeAttribute(attribute);
    return;
  }

  el.setAttribute(attribute, String(value));
}

export interface Rule {
  match: (node: Element, name: string, value: string) => boolean;
  exec: (node: Element, name: string, value: string, context: any) => void;
}

const rules: Rule[] = [];

export function use(rule: Rule) {
  rules.push(rule);
}

use({
  match(_, name) {
    return name === 'ref';
  },
  exec(node: any, _name: string, value: string, context: any) {
    context[value] ||= ref(null);
    context[value].value = node;
  },
});

use({
  match(_, name) {
    return name.startsWith('on-');
  },
  exec(node, name, value, context) {
    const key = name.slice(3);
    const [event, ...tags] = key.split('.');
    const modifiers: any = {
      // Safari's default is true
      passive: false,
    };

    for (const tag of tags) {
      modifiers[tag] = true;
    }

    const fn = createFunction(value, context, ['$event']);
    node.addEventListener(event, (e: Event) => {
      if (modifiers.stop) e.stopPropagation();
      if (modifiers.prevent) e.preventDefault();

      return fn(e);
    });
    node.removeAttribute(name);
  },
});

use({
  match(_, name) {
    return name.startsWith('attr-');
  },
  exec(node, name, source, context) {
    const key = name.slice(5);
    effect(createFunction(source, context), (v: any) => setAttribute(node, key, v));
    node.removeAttribute(name);
  },
});

use({
  match(_, name) {
    return name.startsWith('bind-');
  },
  exec(node, name, source, context) {
    const key = name.slice(5);
    const [property, ...modifiers] = key.split('.');
    const fn = createFunction(source, context);
    const isObject = source.startsWith('{');
    if (key === 'class' && isObject) {
      effect(fn, (map) => {
        for (const [classNames, value] of Object.entries(map)) {
          setClassName(node, classNames, value);
        }
      });
    } else if (key === 'style' && isObject) {
      effect(fn, (map) => {
        for (const [property, value] of Object.entries(map)) {
          setStyle(node, property, value);
        }
      });
    } else {
      effect(fn, (value: any) => setProperty(node, property, value, modifiers));
    }
    node.removeAttribute(name);
  },
});

use({
  match(_, name) {
    return name.startsWith('class-');
  },
  exec(node, name, source, context) {
    const key = name.slice(6);

    effect(createFunction(source, context), (value: any) => setClassName(node, key, value));
    node.removeAttribute(name);
  },
});

use({
  match(_, name) {
    return name.startsWith('style-');
  },
  exec(node, name, source, context) {
    const key = name.slice(6);

    effect(createFunction(source, context), (value: any) => setStyle(node, key, value));
    node.removeAttribute(name);
  },
});

use({
  match(node, name) {
    return node.nodeName === 'TEMPLATE' && name === 'for';
  },
  exec(node, name, source, context) {
    const forNodes: { nodes: Node[]; index: number; item: Signal }[] = [];
    const [left, expression] = source.split('of').map((s) => s.trim());
    const [key, indexKey] = left.includes('[')
      ? left
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim())
      : [left, 'index'];

    effect(createFunction(expression, context), (value: any) => {
      const isArray = Array.isArray(value);
      const itemsToRemove = forNodes.slice(!isArray ? 0 : value.length);

      for (const next of itemsToRemove) {
        for (const node of next.nodes) {
          node.parentNode!.removeChild(node);
        }
      }

      forNodes.length = isArray ? value.length : 0;

      if (!isArray) return;

      const lastInsertedNode = forNodes.at(-1)?.nodes.at(-1) ?? node;
      const length = value.length;
      const nodesToInsert = document.createDocumentFragment();

      for (let i = 0; i < length; i++) {
        const index = i;
        const item = computed(() => value[index]);
        const subContext = {
          [key]: item,
          [indexKey]: i,
        };

        if (!forNodes[i]) {
          const dom = (node as HTMLTemplateElement).content.cloneNode(true);
          forNodes[i] = { item, index, nodes: Array.from(dom.childNodes) };
          const reader = createReadOnlyContext(Object.assign({}, context, subContext));
          linkTreeToContext(dom, reader);
          nodesToInsert.append(dom);
        }
      }

      setTimeout(() => {
        (node as any).parentNode.insertBefore(nodesToInsert, lastInsertedNode);
      });
    });
    node.removeAttribute(name);
  },
});

use({
  match(node, name) {
    return node.nodeName === 'TEMPLATE' && name === 'if';
  },
  exec(node, name, value, context) {
    const source = 'Boolean(' + value + ')';
    const ifNodes: any[] = [];
    let lastValue: any;

    effect(createFunction(source, context), (value: any) => {
      if (value === lastValue) {
        return;
      }

      lastValue = value;

      if (value && !ifNodes.length) {
        const dom = (node as HTMLTemplateElement).content.cloneNode(true);
        ifNodes.push(...Array.from(dom.childNodes));

        linkTreeToContext(dom, context);
        setTimeout(() => {
          (node as any).parentNode.insertBefore(dom, node);
        });
        return;
      }

      if (!value && ifNodes.length) {
        for (const node of ifNodes) {
          node.remove();
        }

        ifNodes.length = 0;
      }
    });
    node.removeAttribute(name);
  },
});