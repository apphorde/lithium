import { setOption } from '@li3/runtime';

// public API
import * as API from './setup.js';
import * as Component from './custom-elements.js';
export * from './setup.js';
export * from './custom-elements.js';

export { createComponent, createInlineComponent, createApp, mount } from './custom-elements.js';

Object.assign(globalThis.Lithium, {
  API: { ...API },
  Component: { ...Component },
});

if (window.name === 'debug') {
  setOption('debugEnabled', true);
}
