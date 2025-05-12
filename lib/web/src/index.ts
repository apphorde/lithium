export { hostClasses, loadCss, loadScript, templateRef } from '@li3/plugins';
export * from '@li3/browser';
export * from '@li3/reactive';
import { Component, onDestroy } from '@li3/browser';
import { createStore as storeFactory } from '@li3/store';
import { type Effect } from '@li3/reactive';

export function createStore(...args: Parameters<typeof storeFactory>) {
  const store = storeFactory(...args);
  const { select } = store;
  const effects: Effect<any>[] = [];

  onDestroy(() => {
    for (const f of effects) {
      f.dispose();
    }
  });

  return {
    ...store,
    select: (selector: any) => {
      const effect = select(selector);
      effects.push(effect);
      return effect;
    },
  };
}

export const load = Component.loadAndParse;
