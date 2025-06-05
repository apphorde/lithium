import { RuntimeContext } from "./types.js";

export function createDispatcher<T extends string[]>(hookNames: T) {
  const hooks: Record<string, any[]> = {};

  const p = {
    reset() {
      for (const next of hookNames) {
        hooks[next] = [];
      }
    },

    use(plugin: Partial<Record<T[number], any>>) {
      for (const next of hookNames) {
        if (plugin[next]) {
          hooks[next].push(plugin);
        }
      }
    },

    apply(hook: T[number], args: any[] = []) {
      const plugins = hooks[hook];
      for (const plugin of plugins) {
        plugin[hook](...args);
      }
    },
  };

  p.reset();

  return p;
}

export const Plugins = createDispatcher([
  "setup",
  "dom",
  "element",
  "attribute",
  "init",
  "update",
  "destroy",
] as const);

export function onSetup<T extends RuntimeContext, S extends object>(f: ($el: T, state: S) => void) {
  Plugins.use({ setup: f });
}


export function onCreateDom<T extends RuntimeContext>(f: ($el: T, dom: DocumentFragment) => void) {
  Plugins.use({ dom: f });
}


export function onVisitElement<T extends RuntimeContext, N extends Node>(f: ($el: T, node: N) => void) {
  Plugins.use({ element: f });
}


export function onVisitAttribute<T extends RuntimeContext, N extends Node>(f: ($el: T, node: N, attribute: string, value: string) => void) {
  Plugins.use({ attribute: f });
}


export function onInitContext<T extends RuntimeContext>(f: ($el: T) => void) {
  Plugins.use({ init: f });
}


export function onUpdateProp<T extends RuntimeContext>(f: ($el: T, prop: string, oldValue: any, newValue: any) => void) {
  Plugins.use({ update: f });
}


export function onDestroyComponent<T extends RuntimeContext>(f: ($el: T) => void) {
  Plugins.use({ destroy: f });
}



onVisitAttribute((_el, node: Element, _attribute, _value) => { console.log(node)})