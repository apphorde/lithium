import { describe, it, expect } from 'vitest';
import { renderPage } from './render.js';
import { readState } from './state.js';

const counterApp = `<!doctype html>
<html><body>
<template app>
  <h1>{{ title }}</h1>
  <p>Count: <strong>{{ count }}</strong></p>
  <template if="count > 0">
    <p>You've clicked {{ count }} times</p>
  </template>
  <button on-click="increment()">+1</button>

  <script setup>
    import { ref, computed } from '@li3/web';
    export default function () {
      const title = ref('Counter App');
      const count = ref(3);
      const doubled = computed(() => count.value * 2);
      const increment = () => count.value++;
      return { title, count, doubled, increment };
    };
  </script>
</template>
</body></html>`;

describe('renderPage', () => {
  it('mounts <template app> and renders initial state', async () => {
    const { html, state } = await renderPage({ html: counterApp });

    expect(html).toContain('<h1>Counter App</h1>');
    expect(html).toContain('<strong>3</strong>');
    expect(html).toContain("You've clicked 3 times");
    expect(state).toEqual([{ title: 'Counter App', count: 3, doubled: 6 }]);
  });

  it('keeps <template app> for hydration by default, with state + bootstrap script', async () => {
    const { html } = await renderPage({ html: counterApp });

    expect(html).toContain('<template app="">');
    expect(html).toContain('data-li3-hydrate');
    expect(html).toContain('data-li3-ssr');
  });

  it('strips templates in static mode', async () => {
    const { html } = await renderPage({ html: counterApp, hydrate: 'static' });

    expect(html).not.toContain('<template app>');
    expect(html).not.toContain('data-li3-hydrate');
    expect(html).not.toContain('data-li3-root');
    expect(html).toContain('<h1>Counter App</h1>');
  });

  it('renders for-loops with per-row context', async () => {
    const app = `<!doctype html><html><body>
      <template app>
        <ul><template for="[t, i] of todos"><li>{{ i }}: {{ t.title }}</li></template></ul>
        <script setup>
          import { ref } from '@li3/web';
          export default function () {
            return { todos: ref([{ title: 'a' }, { title: 'b' }]) };
          };
        </script>
      </template>
    </body></html>`;

    const { html } = await renderPage({ html: app });
    expect(html).toContain('<li>0: a</li>');
    expect(html).toContain('<li>1: b</li>');
  });

  it('defines in-document components and renders them with props', async () => {
    const app = `<!doctype html><html><body>
      <template component="ui-badge">
        <span class="badge">{{ label }}</span>
        <script setup>
          import { defineProp } from '@li3/web';
          export default function () {
            return { label: defineProp('label', { default: 'n/a' }) };
          };
        </script>
      </template>

      <template app>
        <ui-badge label="New"></ui-badge>
      </template>
    </body></html>`;

    const { html } = await renderPage({ html: app });
    expect(html).toContain('<span class="badge">New</span>');
  });

  it('renders declarative <ref> and <script state> apps without setup code', async () => {
    const app = `<!doctype html><html><body>
      <template app>
        <ref name="count" value="7"></ref>
        <script state type="application/json">{ "name": "Ada" }</script>
        <p>{{ name }}: {{ count }}</p>
      </template>
    </body></html>`;

    const { html } = await renderPage({ html: app });
    expect(html).toContain('<p>Ada: 7</p>');
  });

  it('state snapshots can be read back from the rendered HTML', async () => {
    const { html } = await renderPage({ html: counterApp });

    // re-parse the output in a fresh DOM and read embedded state
    const { createDom } = await import('./dom.js');
    const dom = createDom(html);
    try {
      expect(readState(dom.document)).toEqual([{ title: 'Counter App', count: 3, doubled: 6 }]);
    } finally {
      dom.restore();
    }
  });

  it('escapes </script> in embedded state', async () => {
    const { serializeState } = await import('./state.js');
    expect(serializeState({ html: '</script><b>x</b>' })).toBe('{"html":"<\\/script><b>x<\\/b>"}');
  });
});
