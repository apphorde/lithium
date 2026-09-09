import { createDom, importModuleFromFile, type VirtualDom } from './dom.js';
import { embedState, type AppState } from './state.js';

export type RenderOptions = {
  /** Full page HTML containing <template app> / <template component> blocks. */
  html: string;
  /** Page URL. Relative <script setup src> / <link rel="component"> resolve against it. Default: http://localhost/ */
  url?: string;
  /**
   * Component files to load and register before rendering (like
   * <link rel="component">, but resolved by the server). URLs resolve
   * against `url`.
   */
  components?: string[];
  /**
   * Extra wait time (ms) after the initial render flush, for async setup
   * work (fetches, timers). Default: 0.
   */
  settle?: number;
  /**
   * How the rendered page should boot in the browser:
   * - 'hydrate' (default): keep <template> sources and app roots marked with
   *   data-li3-root, embed state snapshots, and add a bootstrap script that
   *   re-mounts every app into its existing root (no duplicate roots).
   * - 'static': strip <template app>/<template component> sources and root
   *   markers — pure static HTML, no client-side Lithium bootstrap.
   * - 'none': keep templates, add nothing (client boots @li3/web normally,
   *   which would create a second root — only use if you wire your own boot).
   */
  hydrate?: 'hydrate' | 'static' | 'none';
  /** State snapshots to embed for hydration. Defaults to collectState(document). */
  state?: AppState[];
};

export type RenderResult = {
  /** The full serialized page, ready to be served. */
  html: string;
  /** The state collected from mounted apps (context values, unwrapped). */
  state: AppState[];
  /** The virtual DOM used for rendering (already restored). */
  dom: VirtualDom;
};

// The framework runs its bootstrap ~10ms after import; bindings flush on a
// ~5ms queue; if/for insertions use setTimeout. Two long waits cover all of it.
const FLUSH_MS = 30;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Boot script injected into the hydrated page. Setting FF.ssr makes findApps()
// adopt the server-rendered, data-li3-root-marked projection divs instead of
// creating duplicate app roots; contents are then re-rendered in place.
const HYDRATE_SCRIPT = `import { setFeatureFlag, autoInitialize } from '@li3/web';
setFeatureFlag('ssr', true);
autoInitialize();`;

/**
 * Renders a Lithium page on the server: mounts every <template app> with all
 * components defined in the page (or passed via `components`), waits for
 * reactive bindings to settle, and serializes the resulting HTML.
 *
 * The returned HTML still contains the original <template app> sources and
 * keeps the rendered app roots (marked with data-li3-root), so the browser
 * re-renders them in place — the page is visible before JavaScript runs and
 * becomes interactive after, without duplicating the app root.
 */
export async function renderPage(options: RenderOptions): Promise<RenderResult> {
  const { html, url = 'http://localhost/', components = [], settle = 0, hydrate = 'hydrate', state } = options;

  const dom = createDom(html, url);
  try {
    // Feature flags must be set before importing @li3/web in this process:
    // skipAutoInitialize gives us control over *when* rendering happens and
    // avoids timers firing after the DOM was torn down.
    (dom.window as any).name = 'skipAutoInitialize';

    const web = await import('@li3/web');
    web.setFeatureFlag('skipAutoInitialize', true);
    web.setFeatureFlag('ssr', true);
    // <script setup>/<script state> sources import via temp files (blob: URLs
    // are not importable in Node), sharing this process's @li3/web instance.
    web.setModuleLoader(importModuleFromFile);

    // Load external components first so in-document components and app
    // templates can use them when they mount.
    for (const href of components) {
      await web.load(href, url);
    }

    // Defines in-document <template component> blocks and mounts <template app>.
    await web.autoInitialize();

    // Flush the watch queue (~5ms), if/for insertions (setTimeout), and any
    // optional async work in setup functions.
    await wait(FLUSH_MS + settle);

    const collectedState = state ?? collectState(dom.document);

    // Mark every app projection root so the hydrating client reuses it.
    for (const root of findProjectionRoots(dom.document)) {
      root.setAttribute('data-li3-root', '');
    }

    if (hydrate === 'static') {
      for (const root of Array.from(dom.document.querySelectorAll('[data-li3-root]'))) {
        root.removeAttribute('data-li3-root');
      }
      for (const t of Array.from(dom.document.querySelectorAll('template[app], template[component]'))) {
        t.remove();
      }
    } else {
      if (collectedState.length) {
        embedState(dom.document, collectedState);
      }
      if (hydrate === 'hydrate') {
        const script = dom.document.createElement('script');
        script.setAttribute('type', 'module');
        script.setAttribute('data-li3-hydrate', '');
        script.textContent = HYDRATE_SCRIPT;
        dom.document.body.appendChild(script);
      }
    }

    const out = serialize(dom);
    return { html: out, state: collectedState, dom };
  } finally {
    dom.restore();
  }
}

/**
 * The projection divs findApps() inserts before each <template app>.
 * Identified as the element sibling immediately preceding a template[app].
 */
function findProjectionRoots(document: Document): HTMLElement[] {
  return Array.from(document.querySelectorAll('template[app]'))
    .map((t) => t.previousElementSibling as HTMLElement | null)
    .filter((el): el is HTMLElement => Boolean(el && el.nodeName === 'DIV'));
}

/**
 * Collects serializable state from every mounted app root: the merged
 * component context (signals unwrapped, functions and DOM nodes dropped).
 */
export function collectState(document: Document): AppState[] {
  return Array.from(document.querySelectorAll('template[app]')).map((template) => {
    const root = template.previousElementSibling as any;
    const debugSymbol = root && Object.getOwnPropertySymbols(root).find((s) => s.description === '#');
    return pickState(debugSymbol ? root[debugSymbol] : undefined);
  });
}

function pickState(context: any): AppState {
  const state: AppState = {};
  if (!context || typeof context !== 'object') return state;

  for (const [key, value] of Object.entries(context)) {
    if (key.startsWith('$') || typeof value === 'function') continue;
    const unwrapped = unwrapValue(value);
    if (unwrapped !== undefined && isSerializable(unwrapped)) {
      state[key] = unwrapped;
    }
  }
  return state;
}

function unwrapValue(value: any): any {
  if (value && typeof value === 'object' && 'value' in value) {
    return value.value; // ref/computed
  }
  return value;
}

function isSerializable(value: any): boolean {
  if (value === null) return true;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isSerializable);
  if (t === 'object') return Object.values(value).every(isSerializable);
  return false;
}

function serialize(dom: VirtualDom): string {
  const serialized = dom.dom.serialize();
  return serialized.startsWith('<!') ? serialized : '<!doctype html>\n' + serialized;
}
