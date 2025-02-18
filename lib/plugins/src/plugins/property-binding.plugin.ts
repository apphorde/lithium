import { setAttribute, setProperty } from '@li3/dom';
import { Plugins, type RuntimeContext } from '@li3/runtime';
import { computedEffect } from '@li3/scope';

Plugins.use({
  attribute($el, node, attribute, value) {
    if (attribute.startsWith('bind-')) {
      createPropertyBinding($el, node, dashToCamelCase(attribute.replace('bind-', '')), value);
    }

    if (attribute.startsWith('attr-')) {
      createAttributeBinding($el, node, dashToCamelCase(attribute.replace('attr-', '')), value);
    }
  },
});

export function createPropertyBinding($el: RuntimeContext, element: Element, name: string, expression: string): void {
  computedEffect($el, expression, (v: any) => setProperty(element, name, v));
}

export function createAttributeBinding($el: RuntimeContext, element: Element, name: string, expression: string): void {
  computedEffect($el, expression, (v: any) => setAttribute(element, name, v));
}

const wellKnownProperties = {
  'base-url': 'baseURL',
  'inner-html': 'innerHTML',
};

function dashToUpperCase(s: string) {
  return s.slice(1).toUpperCase();
}

export function dashToCamelCase(s: string) {
  return wellKnownProperties[s] || s.replace(/([-]{1}[a-z]{1})+/g, dashToUpperCase);
}
