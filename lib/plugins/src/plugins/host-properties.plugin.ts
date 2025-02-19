import { isElement } from '@li3/dom';
import { Plugins, RuntimeContext, getCurrentContext } from '@li3/runtime';

RuntimeContext.use(() => ({
  hostClasses: [],
}));

Plugins.use({
  dom($el: RuntimeContext) {
    applyHostAttributes($el);
  },
});

export function applyHostAttributes($el: RuntimeContext) {
  if (!isElement($el.element)) return;

  const hostClasses = $el.hostClasses.join(' ').trim();
  if (hostClasses) {
    $el.element.className += ' ' + hostClasses;
  }
}

export function hostClasses(classes: string): void {
  getCurrentContext().hostClasses.push(classes);
}
