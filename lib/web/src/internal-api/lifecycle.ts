import { ReactiveContext } from "@li3/reactive";
import { CreateRuntimeOptions, RuntimeContext } from "./types.js";
import { plugins } from "./plugin.js";
import { createState } from "./reactive.js";
import { push, pop } from "./stack.js";
import { createDom, tpl } from "./dom.js";
import { getOption } from "./options.js";

const noop = () => {};
const VM = Symbol("@@Runtime");

export function createRuntimeContext(properties: CreateRuntimeOptions): RuntimeContext {
  const { setup = noop, template, shadowDom } = properties;

  const $el: RuntimeContext = {
    ...properties,
    shadowDom: typeof shadowDom === "string" ? ({ mode: shadowDom } as ShadowRootInit) : shadowDom,
    setup,
    template: !template ? null : typeof template === "string" ? tpl(template) : template,
    stylesheets: [],
    scripts: [],
    state: null,
    props: {},
    stateKeys: [],
    init: [],
    update: [],
    destroy: [],
    reactive: new ReactiveContext(),
  };

  return $el;
}

export function activateContext($el: RuntimeContext) {
  push($el);

  try {
    const { reactive } = $el;
    reactive.suspend();
    createState($el);
    createDom($el);
    reactive.check();
    reactive.unsuspend();
    ($el.element as any).__destroy = () => {
      plugins.apply("destroy", [$el]);
      $el.destroy.forEach((f) => f($el));
    };

    plugins.apply("init", [$el]);
    $el.init.forEach((f) => f($el));

    if (getOption("debugEnabled")) {
      $el.element[VM] = $el;
    }
  } catch (error) {
    if (getOption("debugEnabled")) {
      throw error;
    }

    console.log("Failed to initialize component!", $el, error);
  }

  pop();
}
