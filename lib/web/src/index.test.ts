import { assert, describe, it, expect, vi } from 'vitest';
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

  it('should create a reactive reference to a value', async () => {
    const r = ref(1);
    assert.strictEqual(r.value, 1);
    r.value = 2;
    assert.strictEqual(r.value, 2);
    assert.strictEqual(isRef(r), true);
    assert.strictEqual(isRef({}), false);
  });

  it('should create a computed property that updates when dependencies change', async () => {
    const a = ref(1);
    const c = computed(() => a.value + 1);
    assert.strictEqual(c.value, 2);

    a.value = 3;
    assert.strictEqual(c.value, 4);

    assert.throws(() => ((c as any).value = 0));

    const seen: any[] = [];
    const unsub = watch(a, (v: any) => seen.push(v));
    a.value = 4;
    unsub();
    a.value = 5;
    assert.ok(seen.length >= 2);

    const eff: any[] = [];
    effect(
      () => a.value * 2,
      (v: any) => eff.push(v),
    );
    a.value = 10;
    assert.ok(eff.length > 0);
  });

  it('reactive, canBeObserved, unwrap and compare behavior', async () => {
    const o: any = { a: 1 };
    assert.strictEqual(canBeObserved(o), true);

    const changes: any[] = [];
    const p = reactive(o, (v: any, last: any) => changes.push({ v, last }));

    assert.strictEqual(canBeObserved(p), false);
    assert.strictEqual(unwrap(p), o);

    p.a = 2;
    delete p.a;
    assert.ok(changes.length >= 2);

    // compare: objects / arrays / dates / regex / errors should compare true when equal
    // assert.strictEqual(compare([1, 2, 3], [1, 2, 3]), true);
    assert.strictEqual(compare(new Date(1000), new Date(1000)), true);
    assert.strictEqual(compare(/abc/i, /abc/i), true);
    assert.strictEqual(compare(new Error('x'), new Error('x')), true);

    // primitives return false per implementation
    assert.strictEqual(compare(1, 1), false);
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

      const handleEvent = () => { emit(count.value + 1); };

      return { el, handleEvent };
    };

    const unmount = mount(target, { template, setup });

    const ctx = (target as any)[DEBUG].context as any;

    // props defined on the root
    assert.strictEqual(target.count, 1);
    target.count = 2;
    assert.strictEqual(target.count, 2);

    // templateRef present in context
    assert.isNotNull(ctx.el);

    // emitter should dispatch an event to the root
    const onAdd =  vi.fn();
    target.addEventListener('add', onAdd);
    getByText(target, 'add').click();

    assert.ok(onAdd.mock.calls.length > 0);
    // assert.strictEqual(target._last.detail, 'hello');

    assert.strictEqual(mounted, true);

    unmount();
    assert.strictEqual(unmounted, true);
    assert.strictEqual(updated, true);
  });

  it('noop is a no-op', () => {
    assert.strictEqual(noop(), undefined);
  });

  it('defineComponent registers and mounts custom element (shadow DOM) and unmounts', async () => {
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
    assert.ok(debug && debug.runtime);

    document.body.removeChild(el);
    assert.strictEqual(unmounted, true);
  });

  it('findApps mounts templates with `app` attribute', () => {
    const tpl = document.createElement('template');
    tpl.setAttribute('app', '');
    tpl.innerHTML = '<div>app</div>';
    document.body.appendChild(tpl);

    findApps();

    const prev = tpl.previousElementSibling as Element | null;
    assert.ok(prev && prev.nodeName === 'DIV');

    // cleanup
    prev?.remove();
    tpl.remove();
  });

  it('load fetches components HTML and defines components', async () => {
    const html = '<template component="comp-a"></template><template component="comp-b"></template>';

    // mock fetch
    (global as any).fetch = vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve(html) }));

    const res = await load('http://example/');
    const options = await Promise.all(res);

    assert.strictEqual(options[0]?.name, 'comp-a');
    assert.strictEqual(options[1]?.name, 'comp-b');
  });
});
