import { type ComponentDefinition } from '@li3/runtime';
import { createBlobModule } from '@li3/scope';

export function getShadowDomOptions(template: HTMLTemplateElement): ShadowRootInit {
  const source = template.getAttribute('shadow-dom') || '';

  if (source) {
    return source.startsWith('{') ? JSON.parse(source) : { mode: source };
  }
}

export async function getComponentFromTemplate(template: HTMLTemplateElement): Promise<ComponentDefinition> {
  const setup = template.content.querySelector('script[setup]');
  const component: ComponentDefinition = { template, shadowDom: getShadowDomOptions(template) };

  if (setup) {
    const href = setup.getAttribute('src');
    const md = href
      ? await import(new URL(href, window.location.href).toString())
      : await createBlobModule(setup.textContent.trim(), 'text/javascript');

    setup.remove();
    component.setup = md.default;
  }

  return component;
}

/**
 * Loads a component template from a URL. The source must be a valid HTML template element,
 * with a <script setup> block if the component requires a setup function.
 * <style> tags are also supported as usual.
 *
 * @param url
 * @returns
 */
export async function loadTemplate(url: string | URL) {
  const req = await fetch(url);

  if (req.ok) {
    const html = await req.text();
    const dom = new DOMParser().parseFromString(html, 'text/html');
    const template = dom.querySelector('template');
    return template;
  }

  throw new Error('Unable to load ' + url + ': ' + req.statusText);
}
