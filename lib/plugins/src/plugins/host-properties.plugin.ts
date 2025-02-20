import { isElement } from '@li3/dom';
import { Plugins, RuntimeContext, getCurrentContext } from '@li3/runtime';

export interface HostPropertiesExtension extends RuntimeContext {
  hostClasses: string[];
}

RuntimeContext.use(() => ({
  hostClasses: [],
}));

Plugins.use({
  dom($el: RuntimeContext) {
    applyHostAttributes($el as HostPropertiesExtension);
  },
});

export function applyHostAttributes($el: HostPropertiesExtension): void {
  if (!isElement($el.element)) return;

  const hostClasses = $el.hostClasses.join(' ').trim();
  if (hostClasses) {
    $el.element.className += ' ' + hostClasses;
  }
}

export function hostClasses(classes: string): void {
  getCurrentContext<HostPropertiesExtension>().hostClasses.push(classes);
}
