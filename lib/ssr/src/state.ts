// Server-side state snapshot for hydration.
//
// After rendering, the state of every mounted <template app> can be serialized
// into a <script type="application/json"> tag. In the browser, the same
// template boots again and — because setup functions read their defaults from
// this tag (via `useState` or plain `<script state>`) — renders identically,
// making hydration a plain re-mount.

export type AppState = Record<string, any>;

const ID_ATTR = 'data-li3-ssr';

/** Collects all mounted app roots (the <div style="display:contents"> hosts). */
export function findAppRoots(document: Document): Element[] {
  return Array.from(document.querySelectorAll('[style*="display: contents"], template[app]'))
    .filter((el) => el.nodeName !== 'TEMPLATE') as Element[];
}

/**
 * Serializes a plain value for embedding in a <script> tag.
 * Escapes "</script" so the snapshot can never break out of its element.
 */
export function serializeState(state: AppState): string {
  return JSON.stringify(state).replace(/<\//g, '<\\/');
}

/**
 * Embeds a per-app state snapshot into the document, right after each
 * <template app> (or at the end of <body> when there is none), as
 *   <script type="application/json" data-li3-ssr>...</script>
 * Client-side code can read it back with `readState(document)`.
 */
export function embedState(document: Document, states: AppState[]): void {
  states.forEach((state, index) => {
    const script = document.createElement('script');
    script.setAttribute('type', 'application/json');
    script.setAttribute(ID_ATTR, String(index));
    script.textContent = serializeState(state);

    const templates = Array.from(document.querySelectorAll('template[app]'));
    const anchor = templates[index];
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(script, anchor.nextSibling);
    } else {
      document.body.appendChild(script);
    }
  });
}

/** Reads all embedded state snapshots back, in document order. */
export function readState(document: Document): AppState[] {
  return Array.from(document.querySelectorAll(`script[${ID_ATTR}]`)).map((el) => {
    try {
      return JSON.parse(el.textContent || '{}');
    } catch {
      return {};
    }
  });
}

/**
 * Setup helper for SSR-friendly apps: returns a ref-like initial value,
 * preferring the embedded server snapshot over the given default.
 *
 * ```ts
 * export default function () {
 *   const todos = useState('todos', []);
 *   return { todos };
 * }
 * ```
 */
export function snapshotOrDefault<T>(snapshots: AppState[], index: number, key: string, fallback: T): T {
  const state = snapshots[index];
  return state && key in state ? (state[key] as T) : fallback;
}
