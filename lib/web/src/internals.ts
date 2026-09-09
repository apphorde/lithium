import { isRef } from './reactivity.js';
import type { AnyFunction } from './types';

const validAttribute = /^[a-zA-Z_][a-zA-Z0-9\-_:.]*$/;
export const isValidAttribute = (s) => validAttribute.test(s);

export function walkDomTree(tree: Node, fn: AnyFunction, context: any) {
  const stack: Node[] = tree.childNodes ? Array.from(tree.childNodes) : [];
  let node;

  while ((node = stack.shift() as Node)) {
    fn(node, context);

    if (node.nodeType === node.ELEMENT_NODE && !(node as any).hasAttribute('do-not-render') && node.childNodes.length) {
      stack.push(...(Array.from(node.childNodes) as any[]));
    }
  }
}

export function createFunction(expression: string, context: any, args: string[] = []) {
  const k = Object.keys(context)
    .filter((key: any) => expression.includes(key))
    .join(', ')
    .trim();
  return Function(...args, (k ? `const { ${k} } = this;` : '') + `return ${expression};`).bind(context);
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
      throw new Error('View contexts are read-only');
    },
  });
}

export const debounce = (fn: any) => {
  let timer: any = 0;
  return function (...args: any[]) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), 1);
  };
};

const stylesheetCache = new Map<string, Promise<CSSStyleSheet>>();

// True when there's no real browser CSS engine (SSR / jsdom). Detected lazily
// via adoptedStyleSheets, which jsdom does not implement. Lazy because the
// document may be swapped in after this module is first imported (SSR).
function isServer(): boolean {
  return typeof document === 'undefined' || !('adoptedStyleSheets' in document);
}

export function importCssModule(href: string): Promise<CSSStyleSheet> {
  if (!stylesheetCache.has(href)) {
    stylesheetCache.set(href, importCssModuleInternal(href));
  }

  return stylesheetCache.get(href)!;
}

let _importCssModule: any = null;

async function importCssModuleInternal(href: string): Promise<CSSStyleSheet> {
  // On the server we never fetch stylesheets, and the dynamic
  // import(href, { with: { type: 'css' } }) would fail against the page URL.
  if (isServer()) {
    return new CSSStyleSheet();
  }

  if (!_importCssModule) {
    _importCssModule = importModuleFromSource(
      'export default function(href) { return import(href, { with: { type: "css" } }) }',
    );
  }

  if (typeof _importCssModule !== 'function') {
    _importCssModule = (await _importCssModule).default;
  }

  try {
    return (await _importCssModule(href)).default as CSSStyleSheet;
  } catch {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@import url(${href})`);
    return sheet;
  }
}

// Pluggable loader for importing setup/state modules from source text.
// Browsers use the Blob + object-URL default below; SSR installs a file-based
// loader (blob: URLs are not importable in Node).
export type ModuleLoader = (sourceText: string, origin?: string) => Promise<any>;

let moduleLoader: ModuleLoader | null = null;

export function setModuleLoader(loader: ModuleLoader | null) {
  moduleLoader = loader;
}

export async function importModuleFromSource(sourceText: string, origin?: string) {
  if (moduleLoader) {
    return moduleLoader(sourceText, origin);
  }

  let fileName;
  if (origin) {
    fileName = String(origin).replace('.html', '.mjs');
    const originalFile = new URL(fileName, 'https://li3.dev');
    originalFile.pathname = originalFile.pathname.replace('.mjs', '.src.mjs');
    const lineCount = sourceText.split(/\r?\n/).length;
    const mappings = new Array(lineCount).fill('AACA');
    mappings[0] = 'AAAA';

    const sourceMap = {
      version: 3,
      file: fileName,
      sourcesContent: [sourceText],
      sources: [String(originalFile)],
      mappings: mappings.join(';'),
    };

    const jsonString = JSON.stringify(sourceMap);
    const base64Map = btoa(unescape(encodeURIComponent(jsonString)));
    const mapUrl = `data:application/json;charset=utf-8;base64,${base64Map}`;
    sourceText += `\n//# sourceMappingURL=${mapUrl}\n//# sourceURL=${fileName}`;
  }

  const blob = new Blob([sourceText], { type: 'application/javascript' });
  const objectUrl = URL.createObjectURL(blob);

  try {
    return await import(objectUrl);
  } catch (error) {
    if (origin && error instanceof Error && error.stack) {
      const blobUrlPattern = new RegExp(objectUrl, 'g');
      error.stack = error.stack.replace(blobUrlPattern, fileName);
    }

    throw error;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export const toCamelCase = (s) => s.replace(/-([a-z])/g, (_: any, letter: string) => letter.toUpperCase());

export function eventEmitter(element, name, value) {
  const event = new CustomEvent(name, { detail: value });
  const handler = element['on' + name];

  if (typeof handler === 'function') {
    handler(event);
  }

  element.dispatchEvent(event);

  return event;
}

