import { RuntimeContext } from '@li3/runtime';
import { HostPropertiesExtension } from './plugins/host-properties.plugin.js';
import { InjectResourcesExtension } from './plugins/inject-resources.plugin.js';

export { createAttributeBinding, createPropertyBinding } from './plugins/property-binding.plugin.js';
export { createEventBinding } from './plugins/event-handler.plugin.js';
export { addScriptToPage, adoptStyleSheet, injectStylesheetOnElement, loadCss, loadScript } from './plugins/inject-resources.plugin.js';
export { createClassBinding } from './plugins/set-class.plugin.js';
export { setElementRefValue } from './plugins/set-element-ref.plugin.js';
export { createStyleBinding } from './plugins/set-style.plugin.js';
export { applyHostAttributes, hostClasses } from './plugins/host-properties.plugin.js';
export { templateForOf } from './plugins/template-for.plugin.js';
export { templateIf } from './plugins/template-if.plugin.js';
export { createTextNodeBinding } from './plugins/text-template.plugin.js';

export type RuntimeContextExtensions = RuntimeContext & InjectResourcesExtension & HostPropertiesExtension;
