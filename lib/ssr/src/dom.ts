import { JSDOM } from 'jsdom';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export type VirtualDom = {
  /** The underlying JSDOM instance. */
  dom: JSDOM;
  /** The jsdom `window`, also installed as `globalThis.window`. */
  window: JSDOM['window'];
  /** The jsdom `document`, also installed as `globalThis.document`. */
  document: Document;
  /** Restores the previous global environment. Always call this when done. */
  restore: () => void;
};

// Globals @li3/web (or user setup code) may touch. Restored after rendering.
const GLOBAL_KEYS = [
  'window',
  'document',
  'navigator',
  'location',
  'customElements',
  'HTMLElement',
  'HTMLTemplateElement',
  'Element',
  'Node',
  'Text',
  'Comment',
  'DocumentFragment',
  'CSSStyleSheet',
  'CustomEvent',
  'Event',
  'DOMParser',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
] as const;

let setupDir: string | null = null;
let setupCount = 0;

// Resolves the installed @li3/web entry lazily, relative to this package's own
// dependency graph, so setup modules can share the SSR process's instance.
let webEntry: string | null = null;
function webEntryHref(): string {
  if (!webEntry) {
    const sourceEntry = new URL('../../web/index.js', import.meta.url);
    const builtEntry = new URL('../web/index.js', import.meta.url);
    webEntry = import.meta.url.endsWith('/src/dom.ts') ? sourceEntry.href : builtEntry.href;
  }
  return webEntry;
}

/**
 * File-based loader for <script setup>/<script state> sources, installed via
 * @li3/web's setModuleLoader(). blob: URLs are not importable in Node, so the
 * source is written to a temp .mjs file and imported by file:// URL. Bare
 * "@li3/web" imports are rewritten to the absolute file URL of the installed
 * package so components share the SSR process's single @li3/web instance.
 */
export async function importModuleFromFile(sourceText: string, _origin?: string): Promise<any> {
  setupDir ||= mkdtempSync(join(tmpdir(), 'li3-ssr-'));
  const code = sourceText.includes('@li3/web')
    ? sourceText.replaceAll(`'@li3/web'`, `'${webEntryHref()}'`).replaceAll('"@li3/web"', `"${webEntryHref()}"`)
    : sourceText;
  const file = join(setupDir, `setup-${setupCount++}.mjs`);
  writeFileSync(file, code);
  return import(pathToFileURL(file).href);
}

/**
 * Creates a virtual server DOM for a page and installs it as the global
 * environment, so `@li3/web` can run on the server exactly like in a browser.
 *
 * Call BEFORE importing `@li3/web` in the process — the library reads
 * globals like `document` lazily, but `window.name` feature flags and the
 * CSS/server detection read the environment around import time.
 */
export function createDom(html = '<!doctype html><html><body></body></html>', url = 'http://localhost/'): VirtualDom {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true });
  const { window } = dom;

  const saved: Record<string, { descriptor?: PropertyDescriptor }> = {};
  for (const key of GLOBAL_KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    saved[key] = { descriptor };

    const value = key === 'window' ? window : key === 'document' ? window.document : (window as any)[key];
    if (value === undefined) continue;

    // defineProperty so getter-only globals (e.g. Node's navigator) are replaceable
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }

  let restored = false;
  function restore() {
    if (restored) return;
    restored = true;
    for (const key of GLOBAL_KEYS) {
      const { descriptor } = saved[key];
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        delete (globalThis as any)[key];
      }
    }
    window.close();
  }

  return { dom, window, document: window.document as unknown as Document, restore };
}

/** Helper around createDom: installs the DOM, runs fn, always restores. */
export async function withDom<T>(html: string, url: string, fn: (dom: VirtualDom) => T | Promise<T>): Promise<T> {
  const dom = createDom(html, url);
  try {
    return await fn(dom);
  } finally {
    dom.restore();
  }
}
