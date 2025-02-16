import { isElement } from '../internal-api/dom.js';
import { plugins } from '../internal-api/plugin.js';
import type { RuntimeContext } from '../internal-api/types';

plugins.use({
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
