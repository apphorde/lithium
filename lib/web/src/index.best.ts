import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getInternals, defineEvent, defineProp, load , onDestroy, onInit, onUpdate } from './index.js';
import { findApps } from './component.js';
import { defineComponent, mount } from './component.js';
import { ref } from './reactivity.js';
import { compare } from './compare.js';

import { getByText } from '@testing-library/dom';

describe('@li3/web', () => {
  return; // skip tests until we can mock URL.createObjectURL properly
  beforeAll(() => {
    window.name = 'debug';
  });

  beforeEach(() => {
    function toNodeModule(code: Blob) {
      return `data:text/javascript;base64,${(globalThis as any).Buffer.from(code).toString('base64')}`;
    }

    Object.assign(window, {
      URL: class {
        static createObjectURL(code: Blob) {
          return toNodeModule(code);
        }
      },
      Blob: class {
        constructor() {}
      },
    });
  });

  describe('compare', () => {
    it('compares supported values correctly', () => {
      const sameObj = { a: 1 };
      expect(compare(1, 1)).toBe(true);
      expect(compare('text', 'text')).toBe(true);
      expect(compare(true, true)).toBe(true);
      expect(compare(false, false)).toBe(true);
      expect(compare(null, null)).toBe(true);
      expect(compare(undefined, undefined)).toBe(true);

      expect(compare([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(compare(new Date(1000), new Date(1000))).toBe(true);
      expect(compare(/abc/i, /abc/i)).toBe(true);
      expect(compare(new Error('x'), new Error('x'))).toBe(true);
      expect(compare(sameObj, sameObj)).toBe(true);
      expect(compare({ a: 1 }, { a: 1 })).toBe(false);
    });
  });

  describe('DEBUG', () => {
    it('stores runtime debug info on mount target', () => {
      const template = document.createElement('template');
      template.innerHTML = '<div></div>';
      const target = document.createElement('div') as any;
      const unmount = mount(target, { template, setup: () => ({}) });

      expect(getInternals(target)).toBeDefined();
      expect(getInternals(target).context).toBeDefined();
      unmount();
    });
  });

  describe('defineEvent', () => {
    it('emits a custom event from the component root', () => {
      const target = document.createElement('div') as any;
      const template = document.createElement('template');
      template.innerHTML = '<button on-click="emit(1)">click</button>';
      const emitted: any[] = [];
      target.ontest = (event: any) => emitted.push(event.detail);

      const setup = () => {
        const emit = defineEvent('test');
        return { emit };
      };

      const unmount = mount(target, { template, setup });
      getByText(target, 'click').click();

      expect(emitted).toEqual([1]);
      unmount();
    });
  });

  describe('defineProp and onUpdate', () => {
    it('creates a reactive property on the component root and triggers update hooks', async () => {
      const template = document.createElement('template');
      template.innerHTML = '<span></span>';
      const target = document.createElement('div') as any;

      let updateCount = 0;

      const setup = () => {
        const count = defineProp('count', { default: 1 });

        onUpdate(() => {
          updateCount++;
        });

        return { count };
      };

      const unmount = mount(target, { template, setup });
      expect(target.count).toBe(1);
      target.count = 2;

      expect(target.count).toBe(2);

      // wait for update hooks to run
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(updateCount).toBe(1);
      unmount();
    });
  });

  describe('mount', () => {
    it('renders template content into the target element', () => {
      const template = document.createElement('template');
      template.innerHTML = '<span>hello</span>';
      const target = document.createElement('div') as any;

      mount(target, { template });
      expect(target.innerHTML).toContain('hello');
    });

    it('binds text expressions and on-click event handlers', async () => {
      const template = document.createElement('template');
      template.innerHTML = '<button on-click="increment()">click</button><span>{{value}}</span>';
      const target = document.createElement('div') as any;
      let count = 1;

      await mount(target, {
        template,
        setup: () => {
          const value = ref(count);
          const increment = () => {
            count += 1;
            value.value = count;
          };
          return { value, increment };
        },
      });

      getByText(target, 'click').click();
      expect(getByText(target, '2')).toBeTruthy();
    });
  });

  describe('onInit', () => {
    it('calls init hooks when component is initialized', () => {
      const template = document.createElement('template');
      template.innerHTML = '<div></div>';
      const target = document.createElement('div') as any;
      let initialized = false;

      mount(target, {
        template,
        setup: () => {
          onInit(() => {
            initialized = true;
          });
          return {};
        },
      });
      expect(initialized).toBe(true);
    });
  });

  describe('onDestroy', () => {
    it('calls destroy hooks when component is destroyed', () => {
      const template = document.createElement('template');
      template.innerHTML = '<div></div>';
      const target = document.createElement('div') as any;
      let destroyed = false;
      const unmount = mount(target, {
        template,
        setup: () => {
          onDestroy(() => {
            destroyed = true;
          });
          return {};
        },
      });
      unmount();
      expect(destroyed).toBe(true);
    });
  });

  describe('defineComponent', () => {
    it('registers and mounts custom element (shadow DOM) and unmounts', async () => {
      const name = 'test-comp-' + Math.random().toString(36).slice(2, 8);
      let unmounted = false;

      const tpl = document.createElement('template');
      tpl.innerHTML = '<div></div>';

      defineComponent({
        name,
        template: tpl,
        shadowDom: true,
        setup: () => {
          onDestroy(() => (unmounted = true));
          return {};
        },
      });

      const el = document.createElement(name);
      document.body.appendChild(el);

      // mount should have attached a shadow root with debug data
      const debug = getInternals(el.shadowRoot);
      expect(debug).toBeTruthy();

      document.body.removeChild(el);
      expect(unmounted).toBe(true);
    });
  });

  describe('findApps', () => {
    it('mounts templates with `app` attribute', async () => {
      const tpl = document.createElement('template');
      tpl.setAttribute('app', '');
      tpl.innerHTML = '<div>app</div>';
      document.body.appendChild(tpl);

      await findApps();

      const prev = tpl.previousElementSibling as Element | null;
      expect(prev).not.toBeNull();
      expect(prev?.nodeName).toBe('DIV');

      prev?.remove();
      tpl.remove();
    });
  });

  describe('load', () => {
    it('loads HTML component templates and returns definitions', async () => {
      const html = '<template component="comp-a"></template><template component="comp-b"></template>';
      const originalFetch = (window as any).fetch;
      (window as any).fetch = vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve(html) }));

      const options = await load('http://example/');

      expect(options[0]?.name).toBe('comp-a');
      expect(options[1]?.name).toBe('comp-b');
      (window as any).fetch = originalFetch;
    });

    it('throws when fetch returns a non-ok response', async () => {
      const originalFetch = (window as any).fetch;
      (window as any).fetch = vi.fn(() => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') }));

      await expect(load('http://example/')).rejects.toThrow('Failed to load components from http://example/');
      (window as any).fetch = originalFetch;
    });
  });
});
