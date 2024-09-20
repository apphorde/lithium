import { DOM } from "./dom.js";
import { getCurrentInstance } from "./runtime.js";

export function loadCss(url: string, id: string, condition: boolean): void {
  getCurrentInstance().stylesheets.push([url, id, condition]);
}

export function loadScript(url: string, id: string, condition: boolean): void {
  getCurrentInstance().scripts.push([url, id, condition]);
}

export function onInit(fn: VoidFunction): void {
  getCurrentInstance().init = fn;
}

export function onDestroy(fn: VoidFunction): void {
  getCurrentInstance().destroy = fn;
}

export function computed<T>(fn: () => T): Ref<T> {
  const $ref = ref<T>();
  watch(() => {
    const v = fn();
    if ($ref.value !== v) {
      $ref.value = v;
    }
  });

  return $ref;
}

export type EventEmitterFn = (event: string, detail: any) => void;
export function defineEvents(eventNames: any): EventEmitterFn {
  const el = getCurrentInstance().element;

  for (const event of eventNames) {
    DOM.defineEvent(el, event);
  }

  return (e, d) => DOM.emitEvent(el, e, d);
}

function getPropValue($el: RuntimeInfo, property: string, definition: any) {
  if ($el.props && property in $el.props) {
    return $el.props[property];
  }

  if ($el.element.hasOwnProperty(property)) {
    return $el.element[property];
  }

  if ($el.element.getAttribute && $el.element.hasAttribute(property)) {
    return $el.element.getAttribute(property);
  }

  if (definition && definition.default) {
    if (typeof definition.default === "function") {
      return definition.default();
    }

    return definition.default;
  }
}

export function defineProps(definitions: string[] | Record<string, any>): any {
  const keys = !Array.isArray(definitions)
    ? Object.keys(definitions)
    : definitions;

  const $el = getCurrentInstance();
  const { element, state } = $el;
  const props = {};

  for (const property of keys) {
    let initialValue = getPropValue($el, property, definitions[property]);

    const $ref = $el.reactive.ref(initialValue);
    state[property] = $ref;
    props[property] = $ref;

    if (element.nodeType !== element.ELEMENT_NODE) {
      return;
    }

    Object.defineProperty(element, property, {
      get() {
        return $ref.value;
      },
      set(value) {
        $ref.value = value;
      },
    });
  }

  return new Proxy(
    { __w: true },
    {
      get(_t, p) {
        if (p === "__w") return true;

        if (props[p]) {
          return props[p].value;
        }
      },
      set(_t, p, value) {
        if (props[p] && props[p].value !== value) {
          $el.reactive.suspend();
          props[p].value = value;
          $el.reactive.unsuspend();
        }

        return true;
      },
    }
  );
}

export function watch(expression: AnyFunction, effect?: AnyFunction): void {
  return getCurrentInstance().reactive.watch(expression, effect);
}

export function ref<T>(value?: T, options?): Ref<T> {
  return getCurrentInstance().reactive.ref(value, options);
}

export function html(text: string) {
  const dom = new DOMParser().parseFromString(text, "text/html");
  const tree = mapTree(dom.body, (element) => {
    if (element.nodeType === element.TEXT_NODE) {
      return (element as Text).textContent;
    }

    if (element.nodeType === element.ELEMENT_NODE) {
      return [
        element.nodeName.toLowerCase(),
        getAttributes(element as Element),
        [],
      ];
    }
  });

  return ["#", "html", tree];
}

function mapTree(
  tree: ChildNode | Document | DocumentFragment,
  mapper: (node: ChildNode) => any
) {
  return Array.from(tree.childNodes).map((next) => {
    const parsed = mapper(next);

    if (next.childNodes?.length) {
      parsed[2] = mapTree(next, mapper);
    }

    return parsed || "";
  });
}

function getAttributes(node: Element) {
  return Array.from(node.attributes).map((a) => [a.localName, a.value]);
}
