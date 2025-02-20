import { createBlobModule } from '@li3/scope';
import { Plugins, RuntimeContext, getCurrentContext } from '@li3/runtime';

export interface InjectResourcesExtension extends RuntimeContext {
  stylesheets: string[];
  scripts: string[];
}

export function loadCss(url: string): void {
  getCurrentContext<InjectResourcesExtension>().stylesheets.push(url);
}

export function loadScript(url: string): void {
  getCurrentContext<InjectResourcesExtension>().scripts.push(url);
}

RuntimeContext.use(() => ({
  stylesheets: [],
  scripts: [],
}));

Plugins.use({
  async init($el: RuntimeContext) {
    const { element, stylesheets, scripts } = $el as InjectResourcesExtension;

    // TODO wait for scripts and stylesheets before component is mounted
    stylesheets.map((url) => adoptStyleSheet(element as HTMLElement, url));
    scripts.map((src) => addScriptToPage(src));
  },
});

export function injectStylesheetOnElement(el: HTMLElement | DocumentFragment, href: string) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.disabled = true;
  link.crossOrigin = 'anonymous';
  link.addEventListener('load', () => (link['loaded'] = true));

  el.append(link);

  return link;
}

const stylesheetCache = new Map<string, CSSStyleSheet>();
let _importCssModule: any = createBlobModule(
  'export default function(href) { return import(href, { with: { type: "css" } }) }',
);

async function importCssModule(href: string) {
  if (typeof _importCssModule !== 'function') {
    _importCssModule = (await _importCssModule).default;
  }

  return (await _importCssModule(href)).default;
}

export async function adoptStyleSheet(target: HTMLElement | Document, href: string) {
  if (!stylesheetCache.has(href)) {
    const mod = await importCssModule(href);
    stylesheetCache.set(href, mod);
  }

  const stylesheet = stylesheetCache.get(href);
  (target['shadowRoot'] || document).adoptedStyleSheets.push(stylesheet);
}

const scriptCache = new Map<string, any>();

export function addScriptToPage(src: string) {
  if (scriptCache.has(src)) {
    return scriptCache.get(src);
  }

  const tag = document.createElement('script');
  tag.src = src;
  scriptCache.set(src, tag);
  document.head.append(tag);

  return new Promise((resolve) => {
    tag.onload = () => resolve(tag);
  });
}
