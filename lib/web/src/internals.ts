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
      const t = target[key];
      if (t !== undefined) {
        if (t && isRef(t)) {
          return t.value;
        }

        return t;
      }
    },

    set() {
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

export function createContext(
  element: Element,
  setup: any,
  dom: DocumentFragment,
) {
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
  } catch (e) {
    console.error(e);
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

const stylesheetCache = new Map<string, Promise<CSSStyleSheet>>();

export function importCssModule(href: string) {
  if (!stylesheetCache.has(href)) {
    stylesheetCache.set(href, importCssModuleInternal(href));
  }

  return stylesheetCache.get(href);
}

async function importCssModuleInternal(href: string) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`@import url(${href})`);
  return sheet;
}

export async function importModuleFromSource(
  sourceText: string,
  origin: string,
) {
  if (origin) {
    const fileName = String(origin).replace(".html", ".mjs");
    const originalFile = new URL(fileName, 'https://li3.dev');
    originalFile.pathname = originalFile.pathname.replace('.mjs', '.src.mjs');
    const lineCount = sourceText.split(/\r?\n/).length;
    const mappings = new Array(lineCount).fill("AACA");
    mappings[0] = "AAAA";

    const sourceMap = {
      version: 3,
      file: fileName,
      sourcesContent: [sourceText],
      sources: [String(originalFile)],
      mappings: mappings.join(";"),
    };

    const jsonString = JSON.stringify(sourceMap);
    const base64Map = btoa(unescape(encodeURIComponent(jsonString)));
    const mapUrl = `data:application/json;charset=utf-8;base64,${base64Map}`;
    sourceText += `\n//# sourceMappingURL=${mapUrl}\n//# sourceURL=${fileName}`;
  }

  const blob = new Blob([sourceText], { type: "application/javascript" });
  const objectUrl = URL.createObjectURL(blob);

  try {
    return await import(objectUrl);
  } catch (error) {
    if (origin && error instanceof Error && error.stack) {
      const blobUrlPattern = new RegExp(objectUrl, "g");
      error.stack = error.stack.replace(blobUrlPattern, fileName);
    }
    
    throw error;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
