import { setOption } from '@li3/runtime';
import * as API from './setup.js';
import * as Component from './custom-elements.js';
import { getComponentFromTemplate } from './internal.js';
import { domReady } from '@li3/dom';

export * from './setup.js';
export { Component };

Object.assign(globalThis.Lithium, {
  API: { ...API },
  Component: { ...Component },
});

if (window.name === 'debug') {
  setOption('debugEnabled', true);
}

domReady(function () {
  const inline: HTMLTemplateElement[] = Array.from(document.querySelectorAll('template[component]'));
  const apps: HTMLTemplateElement[] = Array.from(document.querySelectorAll('template[app]'));

  for (const template of inline) {
    Component.createComponentFromTemplate(template);
  }

  for (const template of apps) {
    getComponentFromTemplate(template).then((spec) => Component.createApp(template, spec));
  }
});
