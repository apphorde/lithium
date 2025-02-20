import { isElement } from '@li3/dom';
import { Plugins, RuntimeContext, getCurrentContext } from '@li3/runtime';

interface Extension extends RuntimeContext {
  hostClasses: string[];
}

RuntimeContext.use(() => ({
  hostClasses: [],
}));

Plugins.use({
  dom($el: RuntimeContext) {
    applyHostAttributes($el as Extension);
  },
});

export function applyHostAttributes($el: Extension): void {
  if (!isElement($el.element)) return;

  const hostClasses = $el.hostClasses.join(' ').trim();
  if (hostClasses) {
    $el.element.className += ' ' + hostClasses;
  }
}

export function hostClasses(classes: string): void {
  getCurrentContext<Extension>().hostClasses.push(classes);
}
