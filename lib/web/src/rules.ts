import { createFunction, createReadOnlyContext, walkDomTree, toCamelCase, isValidAttribute } from './internals.js';
import { ref, computed, disposeScope, effect, onCleanup, runInScope, watch, suspend } from './reactivity.js';
import type { Signal } from './reactivity';
import type { AnyFunction } from './types';
import { FF } from './feature-flags.js';

const isElement = (x: any): x is Element => x.nodeType === x.ELEMENT_NODE;
const isText = (x: any): x is Text => x.nodeType === x.TEXT_NODE;

export function applyTextRules(node: Text, context: any) {
  const template = node.textContent.trim();

  if (!template || !template.includes('{{')) return;

  const source = '`' + template.replace(/{{(.*?)}}/g, (_: any, exp: string) => '${' + exp.trim() + '}') + '`';

  effect(createFunction(source, context), (v: any) => setText(node, v));
}

export function applyElementRules(node: Element, context: any) {
  for (const attr of Array.from(node.attributes)) {
    const name = attr.name;
    const value = attr.value.trim();

    for (const rule of rules) {
      if (rule.match(node, name, value)) {
        rule.exec(node, name, value, context);
        FF.debug || node.removeAttribute(name);
        break;
      }
    }
  }
}

export function applyRules(node: Node, context: any) {
  if (isText(node)) {
    applyTextRules(node, context);
    return;
  }

  if (isElement(node)) {
    applyElementRules(node, context);
    return;
  }
}

export function linkTreeToContext(tree: Node, context: any) {
  walkDomTree(tree, applyRules, context);
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
  el.style[key] = value;
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

function setAttribute(el: Element, attribute: string, value: boolean, modifiers: string[]): void {
  if (!isValidAttribute(attribute)) {
    return;
  }

  if (modifiers.includes('bool')) {
    el.toggleAttribute(attribute, !!value);
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

export function resetRules() {
  rules.length = 0;
}

export class AddEventListener implements Rule {
  match(_, name) {
    return name.startsWith('on-');
  }

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
    const listener = (e: Event) => {
      if (modifiers.stop) e.stopPropagation();
      if (modifiers.prevent) e.preventDefault();
      if (modifiers.self && e.target !== node) return;

      return fn(e);
    };
    node.addEventListener(event, listener);
    onCleanup(() => node.removeEventListener(event, listener));
  }
}

export class SetAttribute implements Rule {
  match(_, name) {
    return name.startsWith('attr-');
  }

  exec(node, name, source, context) {
    const [key, ...modifiers] = name.slice(5).split('.');

    effect(createFunction(source, context), (v: any) => setAttribute(node, key, v, modifiers));
  }
}

export class SetProperty implements Rule {
  match(_, name) {
    return name.startsWith('bind-');
  }

  exec(node, name, source, context) {
    const key = name.slice(5);
    const fn = createFunction(source, context);
    const isObject = source.startsWith('{');

    if (key === 'class') {
      const currentValue = node.className;
      effect(fn, (mapOrString) => {
        if (isObject) {
          for (const [classNames, value] of Object.entries(mapOrString || {})) {
            setClassName(node, classNames, value);
          }
        } else {
          node.className = currentValue + ' ' + mapOrString;
        }
      });
      return;
    } 
    
    if (key === 'style' && isObject) {
      effect(fn, (map) => {
        for (const [property, value] of Object.entries(map || {})) {
          setStyle(node, toCamelCase(property), value);
        }
      });
      return;
    } 
    
    const [propertyText, ...modifiers] = key.split('.');
    const property = toCamelCase(propertyText);
    effect(fn, (value: any) => setProperty(node, property, value, modifiers));
  }
}

export class SetClassName implements Rule {
  match(_, name) {
    return name.startsWith('class-');
  }

  exec(node, name, source, context) {
    const key = name.slice(6);

    effect(createFunction(source, context), (value: any) => setClassName(node, key, value));
  }
}

export class SetStyle implements Rule {
  match(_, name) {
    return name.startsWith('style-');
  }

  exec(node, name, source, context) {
    const key = toCamelCase(name.slice(6));

    effect(createFunction(source, context), (value: any) => setStyle(node, key, value));
  }
}

export class TemplateFor implements Rule {
  match(node, name) {
    return node.nodeName === 'TEMPLATE' && name === 'for';
  }

  exec(node, _name, source, context) {
    const forNodes: { nodes: Node[]; index: number; item: Signal; scope: Set<AnyFunction> }[] = [];
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let disposed = false;
    onCleanup(() => {
      disposed = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    });
    const [left, expression] = source.split('of').map((s) => s.trim());
    const [key, indexKey] = left.includes('[')
      ? left
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim())
      : [left, ''];

    const signal = computed(createFunction(`Array.from(${expression} || [])`, context));
    FF.debug && Object.assign(node, { signal, forNodes });
    const anchor = document.createComment('for: ' + source);
    node.replaceWith(anchor);
    let initial = true;
    watch(signal, (value) =>
      this.updateForOfList(
        forNodes,
        anchor,
        node,
        key,
        indexKey,
        context,
        value || [],
        timers,
        () => disposed,
        initial,
      ),
      { immediate: true },
    );
    initial = false;
  }

  updateForOfList(
    forNodes: any[],
    anchor: any,
    node: Node,
    key: string,
    indexKey: string,
    context: any,
    value: any,
    timers: Set<ReturnType<typeof setTimeout>>,
    isDisposed: () => boolean,
    synchronous = false,
  ) {
    value ||= [];
    const newLength = value?.length | 0;
    const itemsToRemove = forNodes.slice(newLength);
    const nodesToRemove = [];

    for (const next of itemsToRemove) {
      suspend(next.item);
      disposeScope(next.scope);
      nodesToRemove.push(...next.nodes);
    }

    if (nodesToRemove.length) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (isDisposed()) return;
        for (const node of nodesToRemove) {
          node.parentNode?.removeChild(node);
        }
      });
      timers.add(timer);
    }

    forNodes.length = newLength;

    if (!newLength) return;

    const lastInsertedNode = forNodes.at(-1)?.nodes.at(-1) ?? anchor;
    const nodesToInsert = document.createDocumentFragment();

    for (let index = 0; index < newLength; index++) {
      if (forNodes[index]) {
        forNodes[index].item.value = value[index];
        continue;
      }

      const item = ref(value[index]);
      const scope = new Set<AnyFunction>();
      const subContext: any = { [key]: item };

      if (indexKey) {
        subContext[indexKey] = ref(index);
      }

      const dom = (node as HTMLTemplateElement).content.cloneNode(true);
      forNodes[index] = { item, index: index, nodes: Array.from(dom.childNodes), scope };
      const reader = createReadOnlyContext(Object.assign({}, context, subContext));
      runInScope(scope, () => linkTreeToContext(dom, reader));
      onCleanup(() => disposeScope(scope));
      nodesToInsert.append(dom);
    }

    if (nodesToInsert.childNodes.length) {
      if (synchronous) {
        if (!isDisposed() && anchor.parentNode) {
          anchor.parentNode.insertBefore(nodesToInsert, lastInsertedNode);
        }
        return;
      }
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (isDisposed() || !anchor.parentNode) return;
        anchor.parentNode.insertBefore(nodesToInsert, lastInsertedNode);
      });
      timers.add(timer);
    }
  }
}

export class TemplateIf implements Rule {
  match(node, name) {
    return node.nodeName === 'TEMPLATE' && name === 'if';
  }

  exec(node, _name, value, context) {
    const source = 'Boolean(' + value + ')';
    const ifNodes: any[] = [];
    let branchScope: Set<AnyFunction> | null = null;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let disposed = false;
    onCleanup(() => {
      disposed = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    });
    const anchor: any = document.createComment('if: ' + value);
    node.replaceWith(anchor);
    let initial = true;

    effect(createFunction(source, context), (value: any, lastValue: any) => {
      if (value === lastValue) {
        return;
      }

      if (value && !ifNodes.length) {
        const dom = (node as HTMLTemplateElement).content.cloneNode(true);
        ifNodes.push(...Array.from(dom.childNodes));
        branchScope = new Set<AnyFunction>();

        runInScope(branchScope, () => linkTreeToContext(dom, context));
        onCleanup(() => branchScope && disposeScope(branchScope));
        if (initial) {
          if (!disposed && anchor.parentNode) anchor.parentNode.insertBefore(dom, anchor);
          return;
        }

        const timer = setTimeout(() => {
          timers.delete(timer);
          if (disposed || !anchor.parentNode) return;
          anchor.parentNode.insertBefore(dom, anchor);
        });
        timers.add(timer);
        return;
      }

      if (!value && ifNodes.length) {
        if (branchScope) disposeScope(branchScope);
        branchScope = null;
        for (const node of ifNodes) {
          node.remove();
        }

        ifNodes.length = 0;
      }
    }, { immediate: true });
    initial = false;
  }
}

use(new TemplateIf());
use(new TemplateFor());
use(new AddEventListener());
use(new SetProperty());
use(new SetAttribute());
use(new SetClassName());
use(new SetStyle());
