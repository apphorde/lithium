import { describe, it } from 'vitest';

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

  describe('ref', () => {
    it('should create a reactive reference to a value', () => {
      // Test implementation goes here
    });
  });

  describe('computed', () => {
    it('should create a computed property that updates when its dependencies change', () => {
      // Test implementation goes here
    });
  });
});
