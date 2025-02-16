import * as Options from './options.js';
import * as State from './reactive.js';
import * as Stack from './stack.js';

export * from './lifecycle.js';
export * from './options.js';
export * from './plugin.js';
export * from './props.js';
export * from './reactive.js';
export * from './stack.js';
export * from './types.js';

globalThis['Lithium'] = {
  Options: { ...Options },
  State: { ...State },
  Stack: { ...Stack },
};
