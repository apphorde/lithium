import { ReactiveContext } from "@li3/reactive";
import { CreateInstanceProperties, RuntimeInternals } from "./types.js";
import { plugins } from "./plugin.js";
import { createState } from "./reactive.js";
import { push, pop } from "./stack.js";
import { createDom, tpl } from "./dom.js";
import { getOption } from "./options.js";

const VM = Symbol("@@Runtime");

const noop = () => {};
const EMPTY = tpl("<slot></slot>");

export function createInstance(properties: CreateInstanceProperties): RuntimeInternals {
  const { setup = noop, template = EMPTY, shadowDom } = properties;
  const $el: RuntimeInternals = {
    ...properties,
    shadowDom: typeof shadowDom === "string" ? ({ mode: shadowDom } as ShadowRootInit) : shadowDom,
    setup,
    template,
    stylesheets: [],
    scripts: [],
    state: {},
    stateKeys: [],
    init: [],
    update: [],
    destroy: [],
    reactive: new ReactiveContext(),
  };

  push($el);

  try {
    const { reactive } = $el;
    reactive.suspend();
    createState($el);
    plugins.apply("setup", [$el]);
    createDom($el);
    reactive.unsuspend();
    reactive.check();

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
    console.log("Failed to initialize component!", $el, error);
  }

  pop();

  return $el;
}
