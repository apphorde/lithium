import { createFunction, createReadOnlyContext, walkDomTree, toCamelCase, isValidAttribute } from "./internals.js";
import { ref, computed, disposeScope, effect, onCleanup, runInScope, watch, suspend } from "./reactivity.js";
import type { Signal } from "./reactivity";
import type { AnyFunction } from "./types";
import { FF } from "./feature-flags.js";

const isElement = (x: any): x is Element => x.nodeType === x.ELEMENT_NODE;
const isText = (x: any): x is Text => x.nodeType === x.TEXT_NODE;

export function applyTextRules(node: Text, context: any) {
  const template = node.textContent.trim();

  if (!template || !template.includes("{{")) return;

  const source = "`" + template.replace(/{{(.*?)}}/g, (_: any, exp: string) => "${" + exp.trim() + "}") + "`";

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
  innerhtml: "innerHTML",
  baseuri: "baseURI",
  class: "className",
};

function setClassName(el: Element, classNames: string, value: any): void {
  for (const cls of classNames.split(".").filter(Boolean)) {
    el.classList.toggle(cls, value);
  }
}

function setStyle(el: any, key: string, value: any): void {
  el.style[key] = value;
}

function setText(el: Text, text: any): void {
  el.textContent = String(text !== undefined ? text : "");
}

function setProperty(node: any, key: string, value: any, modifiers: string[]): void {
  const mappedKey = mappedProperties[key] || key;

  if (modifiers.includes("bool")) {
    node.toggleAttribute(mappedKey, Boolean(value));
  } else {
    node[mappedKey] = value;
  }
}

function setAttribute(el: Element, attribute: string, value: boolean, modifiers: string[]): void {
  if (!isValidAttribute(attribute)) {
    return;
  }

  if (modifiers.includes("bool")) {
    el.toggleAttribute(attribute, !!value);
    return;
  }

  el.setAttribute(attribute, String(value));
}

export interface Rule {
  match: (node: Element, name: string, value: string) => boolean;
  exec: (node: Element, name: string, value: string, context: any, applyChildren?: TreeLinker) => void;
}

const rules: Rule[] = [];
let rulesVersion = 0;
const codePlans = new WeakMap<HTMLTemplateElement, { version: number; apply: TreeLinker }>();

type TreeLinker = (tree: Node, context: any) => void;

export function use(rule: Rule) {
  rules.push(rule);
  rulesVersion++;
}

export function resetRules() {
  rules.length = 0;
  rulesVersion++;
}

export class AddEventListener implements Rule {
  match(_, name) {
    return name.startsWith("on-");
  }

  exec(node, name, value, context) {
    const key = name.slice(3);
    const [event, ...tags] = key.split(".");
    const modifiers: any = {
      // Safari's default is true
      passive: false,
    };

    for (const tag of tags) {
      modifiers[tag] = true;
    }

    const fn = createFunction(value, context, ["$event"]);
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
    return name.startsWith("attr-");
  }

  exec(node, name, source, context) {
    const [key, ...modifiers] = name.slice(5).split(".");

    effect(createFunction(source, context), (v: any) => setAttribute(node, key, v, modifiers));
  }
}

export class SetProperty implements Rule {
  match(_, name) {
    return name.startsWith("bind-");
  }

  exec(node, name, source, context) {
    const key = name.slice(5);
    const fn = createFunction(source, context);
    const isObject = source.startsWith("{");

    if (key === "class") {
      const currentValue = node.className;
      effect(fn, (mapOrString) => {
        if (isObject) {
          for (const [classNames, value] of Object.entries(mapOrString || {})) {
            setClassName(node, classNames, value);
          }
        } else {
          node.className = currentValue + " " + mapOrString;
        }
      });
      return;
    }

    if (key === "style" && isObject) {
      effect(fn, (map) => {
        for (const [property, value] of Object.entries(map || {})) {
          setStyle(node, toCamelCase(property), value);
        }
      });
      return;
    }

    const [propertyText, ...modifiers] = key.split(".");
    const property = toCamelCase(propertyText);
    effect(fn, (value: any) => setProperty(node, property, value, modifiers));
  }
}

export class SetClassName implements Rule {
  match(_, name) {
    return name.startsWith("class-");
  }

  exec(node, name, source, context) {
    const key = name.slice(6);

    effect(createFunction(source, context), (value: any) => setClassName(node, key, value));
  }
}

export class SetStyle implements Rule {
  match(_, name) {
    return name.startsWith("style-");
  }

  exec(node, name, source, context) {
    const key = toCamelCase(name.slice(6));

    effect(createFunction(source, context), (value: any) => setStyle(node, key, value));
  }
}

export class TemplateForeach implements Rule {
  match(node, name) {
    return node.nodeName === "TEMPLATE" && (name === "foreach" || name === "for");
  }

  exec(node, _name, source, context, applyChildren?: TreeLinker) {
    const rows: { nodes: Node[]; index: number; item: Signal; scope: Set<AnyFunction> }[] = [];
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let disposed = false;
    onCleanup(() => {
      disposed = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    });
    const [left, expression] = source.split("of").map((s) => s.trim());
    const [key, indexKey] = left.includes("[")
      ? left
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim())
      : [left, ""];

    const signal = computed(createFunction(`Array.from(${expression} || [])`, context));
    FF.debug && Object.assign(node, { signal, rows });
    const anchor = document.createComment("foreach: " + source);
    node.replaceWith(anchor);
    let initial = true;
    watch(
      signal,
      (value) =>
        this.updateForeachList(
          rows,
          anchor,
          node,
          key,
          indexKey,
          context,
          value ?? [],
          timers,
          () => disposed,
          initial,
          applyChildren,
        ),
      { immediate: true },
    );
    initial = false;
  }

  updateForeachList(
    rows: any[],
    anchor: any,
    node: Node,
    key: string,
    indexKey: string,
    context: any,
    value: any = [],
    timers: Set<ReturnType<typeof setTimeout>>,
    isDisposed: () => boolean,
    synchronous = false,
    applyChildren?: TreeLinker,
  ) {
    const list = value == null ? [] : value;
    const newLength = list.length | 0;
    const itemsToRemove = rows.slice(newLength);
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

    rows.length = newLength;

    if (!newLength) return;

    const lastInsertedNode = rows.at(-1)?.nodes.at(-1) ?? anchor;
    const nodesToInsert = document.createDocumentFragment();

    for (let index = 0; index < newLength; index++) {
      if (rows[index]) {
        rows[index].item.value = list[index];
        continue;
      }

      const item = ref(list[index]);
      const scope = new Set<AnyFunction>();
      const subContext: any = { [key]: item };

      if (indexKey) {
        subContext[indexKey] = ref(index);
      }

      const dom = (node as HTMLTemplateElement).content.cloneNode(true);
      rows[index] = { item, index: index, nodes: Array.from(dom.childNodes), scope };
      const reader = createReadOnlyContext(Object.assign({}, context, subContext));
      runInScope(scope, () => (applyChildren || linkTreeToContext)(dom, reader));
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
    return node.nodeName === "TEMPLATE" && name === "if";
  }

  exec(node, _name, value, context, applyChildren?: TreeLinker) {
    const source = "Boolean(" + value + ")";
    const ifNodes: any[] = [];
    let branchScope: Set<AnyFunction> | null = null;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let disposed = false;
    onCleanup(() => {
      disposed = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    });
    const anchor: any = document.createComment("if: " + value);
    node.replaceWith(anchor);
    let initial = true;

    effect(
      createFunction(source, context),
      (value: any, lastValue: any) => {
        if (value === lastValue) {
          return;
        }

        if (value && !ifNodes.length) {
          const dom = (node as HTMLTemplateElement).content.cloneNode(true);
          ifNodes.push(...Array.from(dom.childNodes));
          branchScope = new Set<AnyFunction>();

          runInScope(branchScope, () => (applyChildren || linkTreeToContext)(dom, context));
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
      },
      { immediate: true },
    );
    initial = false;
  }
}

/** Applies a template's cached, path-based rule plan to a cloned tree. */
export function applyCodePlan(template: HTMLTemplateElement, tree: Node, context: any) {
  let cached = codePlans.get(template);
  if (!cached || cached.version !== rulesVersion) {
    cached = { version: rulesVersion, apply: compileCodePlan(template.content) };
    codePlans.set(template, cached);
  }

  cached.apply(tree, context);
}

function compileCodePlan(tree: Node): TreeLinker {
  const operations: Array<{ path: string; run: (node: Node, context: any) => void }> = [];
  const targets = new Map<string, { path: number[]; variable: string }>();
  const queue: Array<{ node: Node; path: number[] }> = Array.from(tree.childNodes).map((node, index) => ({
    node,
    path: [index],
  }));

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const { node, path } = queue[cursor];
    const pathKey = path.join(".");

    if (node.nodeType === node.TEXT_NODE) {
      if ((node.textContent || "").includes("{{")) {
        if (!targets.has(pathKey)) {
          targets.set(pathKey, { path, variable: `n${targets.size}` });
        }
        operations.push({
          path: pathKey,
          run: (target, context) => applyTextRules(target as Text, context),
        });
      }
      continue;
    }

    if (node.nodeType !== node.ELEMENT_NODE) continue;

    const element = node as Element;
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name;
      const value = attribute.value.trim();
      const rule = rules.find((candidate) => candidate.match(element, name, value));
      if (!rule) continue;

      if (!targets.has(pathKey)) {
        targets.set(pathKey, { path, variable: `n${targets.size}` });
      }
      const structural =
        element.nodeName === "TEMPLATE" &&
        ((rule instanceof TemplateIf && name === "if") ||
          (rule instanceof TemplateForeach && (name === "foreach" || name === "for")));
      const childPlan = structural ? compileCodePlan((element as HTMLTemplateElement).content) : undefined;

      operations.push({
        path: pathKey,
        run: (target, context) => {
          (rule.exec as any).call(rule, target, name, value, context, childPlan);
          if (!FF.debug && target.nodeType === target.ELEMENT_NODE) {
            (target as Element).removeAttribute(name);
          }
        },
      });
    }

    if (!element.hasAttribute("do-not-render") && element.childNodes.length) {
      Array.from(element.childNodes).forEach((child, index) => queue.push({ node: child, path: [...path, index] }));
    }
  }

  const locals: string[] = [];
  const resolved = new Map<string, string>();

  for (const { path, variable } of targets.values()) {
    let parent = "root";
    const prefix: number[] = [];
    for (const index of path) {
      prefix.push(index);
      const key = prefix.join(".");
      let current = resolved.get(key);
      if (!current) {
        current = prefix.length === path.length ? variable : `p${resolved.size}`;
        resolved.set(key, current);
        locals.push(`const ${current} = ${parent}.childNodes[${index}];`);
      }
      parent = current;
    }
  }

  const calls = operations.map(({ path }, index) => `ops[${index}](${targets.get(path)!.variable}, context);`);
  const source = `return function(root, context) { ${locals.join(" ")} ${calls.join(" ")} };`;
  const run = Function("ops", source)(operations.map((operation) => operation.run)) as TreeLinker;
  return run;
}

use(new TemplateIf());
use(new TemplateForeach());
use(new AddEventListener());
use(new SetProperty());
use(new SetAttribute());
use(new SetClassName());
use(new SetStyle());
