import { isRef } from "./reactivity.js";
import type { AnyFunction, RuntimeContext } from "./types";

export function getPropValue<T extends keyof Element>(
  element: Element,
  name: T,
  defaultValue: any,
) {
  const value = element[name];

  if (value !== undefined) {
    return value;
  }

  const attr = element.getAttribute(name);

  if (attr !== null) {
    return attr;
  }

  if (defaultValue !== undefined) {
    return typeof defaultValue === "function" ? defaultValue() : defaultValue;
  }
}

export function walkDomTree(tree: Node, fn: AnyFunction, context: any) {
  const stack: Node[] = tree.childNodes ? Array.from(tree.childNodes) : [];
  let node;

  while ((node = stack.shift() as Node)) {
    fn(node, context);

    if (
      node.nodeType === node.ELEMENT_NODE &&
      !(node as any).hasAttribute("do-not-render") &&
      node.childNodes.length
    ) {
      stack.push(...(Array.from(node.childNodes) as any[]));
    }
  }
}

export function createFunction(
  expression: string,
  context: any,
  args: string[] = [],
) {
  const k = Object.keys(context)
    .filter((key: any) => expression.includes(key))
    .join(", ")
    .trim();
  return Function(
    ...args,
    (k ? `const { ${k} } = this;` : "") + `return ${expression};`,
  ).bind(context);
}

export function createReadOnlyContext(context: any) {
  return new Proxy(context, {
    get(target, key) {
      if (target[key] !== undefined) {
        if (target[key] && isRef(target[key])) {
          return target[key].value;
        }

        return target[key];
      }
    },

    set(target, key, value) {
      if (isRef(value)) {
        target[key] = value;
        return true;
      }

      throw new Error("View contexts are read-only");
    },
  });
}

const runtimeStack: RuntimeContext[] = [];

export function getCurrentNode() {
  const t = runtimeStack.at(-1);

  if (!t) {
    throw new Error("Missing context for this component");
  }

  return t;
}

export function createContext(element: Element, setup: any, dom: DocumentFragment) {
  const runtime: RuntimeContext = {
    dom,
    context: null,
    element,
    mount: [],
    update: [],
    unmount: [],
    props: {},
    refs: {},
  };

  runtimeStack.push(runtime);

  try {
    runtime.context = setup() ?? {};
  } finally {
    runtimeStack.pop();
  }

  return runtime;
}

export const debounce = (fn: any) => {
  let timer: any = 0;
  return function (...args: any[]) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), 1);
  };
};

export const stylesheetCache = new Map<string, Promise<CSSStyleSheet>>();
let _importCssModule: any = importModuleFromSource(
  'export default function(href) { return import(href, { with: { type: "css" } }) }',
);

export async function importCssModule(href: string) {
  if (typeof _importCssModule !== "function") {
    _importCssModule = (await _importCssModule).default;
  }

  try {
    return (await _importCssModule(href)).default;
  } catch {
    // fallback for Safari
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@import url(${href})`);
    return sheet;
  }
}

export async function importModuleFromSource(code: BlobPart) {
  const blob = URL.createObjectURL(
    new Blob([code], { type: "text/javascript" }),
  );
  const module = await import(blob);
  URL.revokeObjectURL(blob);
  return module;
}
