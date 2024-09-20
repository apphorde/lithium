import type { RuntimeInfo } from "./types";

const stack: RuntimeInfo[] = [];

export function getCurrentInstance(): RuntimeInfo {
  return stack[stack.length - 1];
}

export async function createInstance($el: RuntimeInfo): Promise<void> {
  stack.push($el);

  try {
    const { reactive } = $el;
    ensureDisplayBlock($el.element.nodeName);
    reactive.suspend();
    createState();
    createDom();
    reactive.unsuspend();
    reactive.check();

    if ($el.destroy) {
      element.__destroy = $el.destroy;
    }

    if ($el.init) {
      await $el.init();
    }
  } catch (error) {
    console.log("Failed to initialize component!", this, error);
  }

  stack.pop();
  return $el;
}

export class Runtime {
  static compileExpression(expression: string, context: any): AnyFunction {
    const { stateKeys, stateArgs } = getCurrentInstance();
    return DOM.compileExpression(expression, stateKeys).bind(
      context,
      ...stateArgs
    );
  }

  static createBindings(
    state: any,
    element: Element | Text,
    attributes: any
  ): void {
    if (element.nodeType === element.TEXT_NODE) {
      Runtime.createTextNodeBinding(state, <Text>element);
      return;
    }

    if (element.nodeType === element.ELEMENT_NODE) {
      Runtime.createElementNodeBindings(state, <Element>element, attributes);
      return;
    }
  }

  static createTextNodeBinding(context: any, el: Text): void {
    const text = el.textContent;
    if (text.includes("${") || text.includes("{{")) {
      const expression =
        "`" +
        text.replace(
          /\{\{([\s\S]+?)}}/g,
          (_: any, inner: string) => "${ " + inner.trim() + " }"
        ) +
        "`";
      el.textContent = "";
      const fn = Runtime.compileExpression(expression, context);
      watch(wrapTryCatch(expression, fn), (v?: any) => DOM.setText(el, v));
    }
  }

  static createElementNodeBindings(
    context: any,
    el: Element,
    attrs: any
  ): void {
    for (const attr of attrs) {
      const attribute = attr[0].trim();
      const expression = attr[1].trim();

      if (attribute.charAt(0) === ":" || attribute.startsWith("bind-")) {
        Runtime.createElementNodePropertyBinding(
          context,
          el,
          attribute,
          expression
        );
        continue;
      }

      if (attribute.charAt(0) === "@" || attribute.startsWith("on-")) {
        Runtime.createElementNodeEventBinding(
          context,
          el,
          attribute,
          expression
        );
        continue;
      }

      if (attribute.startsWith(".class.")) {
        Runtime.createElementNodeClassBinding(
          context,
          el,
          attribute,
          expression
        );
        continue;
      }

      if (attribute.startsWith(".style.")) {
        Runtime.createElementNodeStyleBinding(
          context,
          el,
          attribute,
          expression
        );
        continue;
      }

      if (attribute === "ref") {
        Runtime.createElementNodeRefBinding(context, el, attribute, expression);
        continue;
      }
    }
  }

  static createElementNodeEventBinding(
    context: any,
    el: any,
    attribute: string,
    expression: any
  ): void {
    const normalized = attribute.startsWith("@")
      ? attribute.slice(1)
      : attribute.replace("on-", "");
    const [eventName, ...flags] = normalized.split(".");
    const { stateKeys, stateArgs } = getCurrentInstance();
    const exec = DOM.compileExpression(expression, [
      ...stateKeys,
      "$event",
    ]).bind(context, ...stateArgs);
    const options = {};

    for (const flag of eventFlags) {
      options[flag] = flags.includes(flag);
    }

    DOM.attachHandler(
      el,
      eventName,
      (e: any) => {
        try {
          exec(e);
        } catch (e) {
          console.error("event failed", expression, e);
        }
      },
      options
    );
  }

  static createElementNodeRefBinding(
    context: { [x: string]: { value: any } },
    el: unknown,
    _attribute: any,
    expression: string
  ): void {
    const ref = expression.trim();

    if (isRef(context[ref])) {
      context[ref].value = el;
    }
  }

  static createElementNodeClassBinding(
    context: any,
    el: any,
    attribute: string,
    expression: any
  ): void {
    const classNames = attribute.replace(".class.", "").replace("class-", "");
    const fn = Runtime.compileExpression(expression, context);
    watch(wrapTryCatch(expression, fn), (v?: any) =>
      DOM.setClassName(el, classNames, v)
    );
  }

  static createElementNodeStyleBinding(
    context: any,
    el: any,
    attribute: string,
    expression: any
  ): void {
    const style = attribute.replace(".style.", "");
    const fn = Runtime.compileExpression(expression, context);
    watch(wrapTryCatch(expression, fn), (v: any) => DOM.setStyle(el, style, v));
  }

  static createElementNodePropertyBinding(
    context: any,
    el: any,
    attribute: string,
    expression: any
  ): void {
    const name = attribute.startsWith("@")
      ? attribute.slice(1)
      : attribute
          .replace("bind-", "")
          .replace(/([-]{1}[a-z]{1})+/g, (s) => s.slice(1).toUpperCase());

    const fn = Runtime.compileExpression(expression, context);

    watch(wrapTryCatch(expression, fn), (v: any) =>
      DOM.setProperty(el, name, v)
    );
  }
}

export function createState(): void {
  const $el = getCurrentInstance();
  const componentData = $el.setup($el, $el.element);
  $el.state = $el.reactive.watchDeep({ ...componentData, ...$el.state });
  $el.stateKeys = Object.keys($el.state);
  $el.stateArgs = $el.stateKeys.map((key) => $el.state[key]);
}

export function createDom(): void {
  const { element, template, shadowDom, stylesheets, scripts, state } =
    getCurrentInstance();

  const dom = DOM.materialize(
    template,
    (el, attrs) => Runtime.createBindings(state, el, attrs),
    {}
  );

  element.innerHTML = "";

  if (!shadowDom) {
    element.append(dom);
  } else {
    element.attachShadow(shadowDom as ShadowRootInit);
    element.shadowRoot.append(dom);
  }

  for (const [a, b, c] of stylesheets) {
    DOM.loadCss(element, a, b, c);
  }

  for (const [a, b, c] of scripts) {
    DOM.loadScript(element, a, b, c);
  }
}

function wrapTryCatch(exp: string, fn: AnyFunction) {
  return () => {
    try {
      const v = fn();
      return unref(v);
    } catch (e) {
      console.log(exp, e);
    }
  };
}

function ensureDisplayBlock(name: string) {
  if (!document.head.querySelector(`[id="ce-${name}"]`)) {
    const css = document.createElement("style");
    css.id = "ce-" + name;
    css.innerText = name.toLowerCase() + "{display:block}";
    document.head.append(css);
  }
}
