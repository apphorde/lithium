import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  canBeObserved,
  compare,
  computed,
  DEBUG,
  defineEvent,
  defineProp,
  effect,
  isRef,
  mount,
  onMount,
  onUnmount,
  onUpdate,
  reactive,
  ref,
  templateRef,
  unwrap,
  watch,
  noop,
  defineComponent,
  findApps,
  load,
} from './index.js';

import { getByText } from '@testing-library/dom';

describe('@li3/web', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  /*
  Public API:

  Reactive values and references
    ref(value)                               Creates a reactive wrapper to a value (a signal)
    computed(fn)                             Creates a computed property that updates when its dependencies change (other computed or refs)
    templateRef(refName: string)             Finds an element with a `ref` attribute in the view and creates a reactive wrapper to it
    hook(value)                              Creates a reactive wrapper using React style hooks (e.g. const [value, setValue] = hook(initialValue))
    watch(ref, callback)                     Watches a reactive source and calls the callback when it changes
    effect(fn, effectFn)                     Runs a function and tracks its dependencies, re-running the effectFn when they change
    reactive(object, effect)                 Creates a reactive version of an object that triggers an effect when it changes
    canBeObserved(object)                    Checks if an object can be observed for reactivity (internal use only)

  Lifecycle Hooks:
    onMounted(fn)                            Called just before the component is mounted (i.e. inserted into the DOM)
    onUnmounted(fn)                          Called just before the component is unmounted (i.e. removed from the DOM)
    onUpdated(fn)                            Called just before the component inputs have changed (i.e. one or more props have changed)

  Component setup definitions:
    defineProp(name, options)                    Defines a prop for a component with the given name and options (type, default value, etc.)
    defineEvent(name)                            Defines a custom event that the component can emit with the given name

  Component definition:
    defineComponent(options)                 Defines a custom element with the given options (name, template, shadowDom and setup function)
    mount(targetElement, options)            Mounts a component to a target element with the given options
    unwrap(object)                           Unwraps a reactive reference or computed property to get its underlying value
    load(href)                               Loads one or more components (as HTML) from a source and registers the  as a custom element

  Internals:
    compare(a, b)                            Compares two values for equality, handling reactive references and computed properties

  */

  describe('canBeObserved', () => {
    it('returns false for null and primitive values, and true for objects', () => {
      expect(canBeObserved(null)).toBe(false);
      expect(canBeObserved(undefined)).toBe(false);
      expect(canBeObserved(123)).toBe(false);
      expect(canBeObserved('text')).toBe(false);
      expect(canBeObserved({})).toBe(true);
      expect(canBeObserved([])).toBe(true);
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

  describe('computed', () => {
    it('should create a computed property that updates when dependencies change', async () => {
      const a = ref(1);
      const c = computed(() => a.value + 1);
      expect(c.value).toBe(2);

      a.value = 3;
      expect(c.value).toBe(4);

      expect(() => ((c as any).value = 0)).toThrow();

      const seen: any[] = [];
      const unsub = watch(a, (v: any) => seen.push(v));
      a.value = 4;
      unsub();
      a.value = 5;
      expect(seen.length).toBeGreaterThanOrEqual(2);

      const eff: any[] = [];
      effect(
        () => a.value * 2,
        (v: any) => eff.push(v),
      );
      a.value = 10;
      expect(eff.length).toBeGreaterThan(0);
    });
  });
  describe('DEBUG', () => {
    it('stores runtime debug info on mount target', () => {
      const template = document.createElement('template');
      template.innerHTML = '<div></div>';
      const target = document.createElement('div') as any;
      const unmount = mount(target, { template, setup: () => ({}) });

      expect(target[DEBUG]).toBeDefined();
      expect(target[DEBUG].runtime).toBeDefined();
      expect(target[DEBUG].context).toBeDefined();
      unmount();
    });
  });

  describe('defineEvent', () => {
    it('emits a custom event from the component root', () => {
      const target = document.createElement('div') as any;
      const template = document.createElement('template');
      template.innerHTML = '<span></span>';
      const emitted: any[] = [];
      target.addEventListener('test', (event: any) => emitted.push(event.detail));

      const setup = () => {
        const emit = defineEvent('test');
        return { emit };
      };

      const unmount = mount(target, { template, setup });
      const ctx = target[DEBUG].context as any;
      ctx.emit('hello');

      expect(emitted).toEqual(['hello']);
      unmount();
    });
  });

  describe('defineProp', () => {
    it('creates a reactive property on the component root and triggers update hooks', () => {
      const template = document.createElement('template');
      template.innerHTML = '<span></span>';
      const target = document.createElement('div') as any;

      let updated = false;
      const setup = () => {
        const count = defineProp('count', { default: 1 });
        onUpdate(() => {
          updated = true;
        });
        return { count };
      };

      const unmount = mount(target, { template, setup });
      expect(target.count).toBe(1);
      target.count = 2;
      expect(target.count).toBe(2);
      expect(updated).toBe(true);
      unmount();
    });
  });

  describe('effect', () => {
    it('runs effect functions when dependencies change', () => {
      const value = ref(2);
      const seen: any[] = [];
      effect(
        () => value.value * 3,
        (next) => seen.push(next),
      );

      expect(seen[0]).toBe(6);
      value.value = 3;
      expect(seen[seen.length - 1]).toBe(9);
    });
  });

  describe('isRef', () => {
    it('identifies refs and computed values as refs', () => {
      const r = ref(1);
      const c = computed(() => r.value + 1);
      expect(isRef(r)).toBe(true);
      expect(isRef(c)).toBe(true);
      expect(isRef({})).toBe(false);
    });
  });

  describe('mount', () => {
    it('renders template content into the target element', () => {
      const template = document.createElement('template');
      template.innerHTML = '<span>hello</span>';
      const target = document.createElement('div') as any;

      mount(target, { template, setup: () => ({}) });
      expect(target.innerHTML).toContain('hello');
    });

    it('binds text expressions and on-click event handlers', () => {
      const template = document.createElement('template');
      template.innerHTML = '<button on-click="increment()">click</button><span>{{value}}</span>';
      const target = document.createElement('div') as any;
      let count = 1;

      mount(target, {
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

      const button = getByText(target, 'click');
      button.click();
      expect(getByText(target, '2')).toBeTruthy();
    });
  });

  describe('onMount', () => {
    it('calls mount hooks when component is mounted', () => {
      const template = document.createElement('template');
      template.innerHTML = '<div></div>';
      const target = document.createElement('div') as any;
      let mounted = false;
      mount(target, {
        template,
        setup: () => {
          onMount(() => {
            mounted = true;
          });
          return {};
        },
      });
      expect(mounted).toBe(true);
    });
  });

  describe('onUnmount', () => {
    it('calls unmount hooks when component is unmounted', () => {
      const template = document.createElement('template');
      template.innerHTML = '<div></div>';
      const target = document.createElement('div') as any;
      let unmounted = false;
      const unmount = mount(target, {
        template,
        setup: () => {
          onUnmount(() => {
            unmounted = true;
          });
          return {};
        },
      });
      unmount();
      expect(unmounted).toBe(true);
    });
  });

  describe('onUpdate', () => {
    it('calls update hooks when root props change', () => {
      const template = document.createElement('template');
      template.innerHTML = '<div></div>';
      const target = document.createElement('div') as any;
      let updated = false;
      const unmount = mount(target, {
        template,
        setup: () => {
          const count = defineProp('count', { default: 0 });
          onUpdate(() => {
            updated = true;
          });
          return { count };
        },
      });
      target.count = 1;
      expect(updated).toBe(true);
      unmount();
    });
  });

  describe('reactive', () => {
    it('should observe changes in an object', async () => {
      const o: any = { a: 1, b: { c: 2 } };
      let changes = 0;
      const p = reactive(o, () => changes++);

      p.a = 2;
      p.b.c = 4;
      delete p.a;
      expect(changes).toBe(3);

      // watch newly added objects
      p.a = { c: 1 }
      expect(changes).toBe(4);

      p.a.c = 2;
      expect(changes).toBe(5);
    });
  });

  describe('ref', () => {
    it('should create a reactive reference to a value', async () => {
      const r = ref(1);
      expect(r.value).toBe(1);
      r.value = 2;
      expect(r.value).toBe(2);
      expect(isRef(r)).toBe(true);
      expect(isRef({})).toBe(false);
    });
  });
  describe('templateRef', () => {
    it('exposes the referenced element inside component setup', () => {
      const template = document.createElement('template');
      template.innerHTML = '<div ref="myRef"></div>';
      const target = document.createElement('div') as any;
      const setup = () => {
        const myRef = templateRef('myRef');
        return { myRef };
      };
      mount(target, { template, setup });
      expect(target[DEBUG].context.myRef.value).not.toBeNull();
    });
  });

  describe('unwrap', () => {
    it('returns raw values for non-reactive objects', () => {
      const raw = { a: 1 };
      expect(unwrap(raw)).toBe(raw);
      expect(unwrap(null)).toBeNull();
    });
  });

  describe('watch', () => {
    it('invokes callback when watched value changes', () => {
      const r = ref(1);
      const seen: any[] = [];
      const unsub = watch(r, (next) => seen.push(next));
      expect(seen[0]).toBe(1);
      r.value = 2;
      expect(seen[seen.length - 1]).toBe(2);
      unsub();
    });
  });

  describe('noop', () => {
    it('is a no-op function', () => {
      expect(noop()).toBeUndefined();
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
          onUnmount(() => (unmounted = true));
          return {};
        },
      });

      const el = document.createElement(name);
      document.body.appendChild(el);

      // mount should have attached a shadow root and set DEBUG on it
      const debug = (el.shadowRoot as any)[DEBUG];
      expect(debug && debug.runtime).toBeTruthy();

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
      const originalFetch = (global as any).fetch;
      (global as any).fetch = vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve(html) }));

      const res = await load('http://example/');
      const options = await Promise.all(res);

      expect(options[0]?.name).toBe('comp-a');
      expect(options[1]?.name).toBe('comp-b');
      (global as any).fetch = originalFetch;
    });

    it('throws when fetch returns a non-ok response', async () => {
      const originalFetch = (global as any).fetch;
      (global as any).fetch = vi.fn(() => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') }));

      await expect(load('http://example/')).rejects.toThrow('Failed to load components from http://example/');
      (global as any).fetch = originalFetch;
    });
  });

  it('defineProp, defineEvent, templateRef and lifecycle hooks via mount', async () => {
    const html = `<div ref="el">{{ count }} <button on-click="handleEvent()">add</button></div>`;
    const template = document.createElement('template');
    template.innerHTML = html;

    const target = document.createElement('div') as any;

    let mounted = false;
    let updated = false;
    let unmounted = false;

    const setup = () => {
      const count = defineProp('count', { default: () => 1 });
      const emit = defineEvent('add');
      const el = templateRef('el');

      onMount(() => (mounted = true));
      onUpdate(() => (updated = true));
      onUnmount(() => (unmounted = true));

      const handleEvent = () => {
        emit(count.value + 1);
      };

      return { el, handleEvent };
    };

    const unmount = mount(target, { template, setup });

    const ctx = (target as any)[DEBUG].context as any;

    // props defined on the root
    expect(target.count).toBe(1);
    target.count = 2;
    expect(target.count).toBe(2);

    // templateRef present in context
    expect(ctx.el).not.toBeNull();

    // emitter should dispatch an event to the root
    const onAdd = vi.fn();
    target.addEventListener('add', onAdd);
    getByText(target, 'add').click();

    expect(onAdd).toHaveBeenCalled();

    expect(mounted).toBe(true);

    unmount();
    expect(unmounted).toBe(true);
    expect(updated).toBe(true);
  });
});
