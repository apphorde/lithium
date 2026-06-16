# @li3/web

## Public API

**Reactive values and references**:

```txt
    ref(value)                               Creates a reactive wrapper to a value (like a signal)
    computed(fn)                             Creates a computed property that updates when its dependencies change (e.g. other computed or refs)
    templateRef(refName: string)             Creates a ref and finds an element with a `ref={refName}` attribute in the view
    hook(value)                              Creates a reactive wrapper using React style hooks (e.g. const [value, setValue] = hook(initialValue))
    watch(ref, callback)                     Watches a reactive source and calls the callback when it changes
    effect(fn, effectFn)                     Runs a function and tracks its dependencies, re-running the effectFn when they change (wraps fn in computed)
    reactive(object, effect)                 Creates a reactive version of an object that triggers an effect when it changes
```

**Lifecycle Hooks:**

```txt
    onInit(fn)                               Called just before the component is initialized
    onDestroy(fn)                            Called just before the component is destroyed
    onUpdate(fn)                             Called just before the component inputs have changed (i.e. one or more props have changed)

```

**Component setup definitions:**

```txt
    defineProp(name, options)                Defines a prop for a component with the given name and options (type, default value, etc.)
    defineEvent(name)                        Defines a custom event that the component can emit with the given name
```

**Component definition:**

```txt
    defineComponent(options)                 Defines a custom element with the given options (name, template, shadowDom and setup function)
    mount(targetElement, options)            Mounts a component to a target element with the given options
    unwrap(object)                           Unwraps a reactive reference or computed property to get its underlying value
    load(href)                               Loads one or more components (as HTML) from a source and registers the  as a custom element
```

**Internals:**

```txt
    compare(a, b)                            Compares two values for equality, handling reactive references and computed properties
    canBeObserved(object)                    Checks if an object can be observed for reactivity (internal use only)
    isRef(x)                                 Check if a value was created with ref()
```

**Extensions:**

```txt
    use(rule)                                Add a new node and attribute matcher. `use({ match(node, attribute, value) {}, exec(node, attribute, value, context) {} })`
```

Set `window.name` to `debug` in any page to attach component context to components
