import { ReactiveContext } from "@lithium/reactive";
import { plugins } from "../internal-api/plugin.js";
import { createState } from "../internal-api/reactive.js";
import { push, pop } from "../internal-api/stack.js";
import { createDom } from "../internal-api/dom.js";
import type {
  ComponentDefinitions,
  RuntimeInternals,
} from "../internal-api/types.js";
import { getOption } from "../internal-api/options.js";

export const noop = () => {};
export const VM = Symbol("@@VM");
const mounted = Symbol();

export interface MountOptions {
  props?: any;
  parent?: any;
}

export function mount(
  element: DocumentFragment | Element | string,
  def: ComponentDefinitions,
  options?: MountOptions
) {
  if (typeof element === "string") {
    element = document.querySelector(element);
  }

  if (!element) {
    throw new Error("Target element not found");
  }

  if (element[mounted]) {
    console.warn("Tried to mount an element twice", element);
    return;
  }

  element[mounted] = true;
  const { setup = noop, template, shadowDom } = def;
  const $el = {
    shadowDom,
    element,
    props: options?.props,
    parent: options?.parent,
    setup,
    stylesheets: [],
    scripts: [],
    template,
    state: {},
    stateKeys: [],
    init: [],
    destroy: [],
    reactive: new ReactiveContext(),
  };

  if (getOption("asyncMount")) {
    return Promise.resolve($el).then(createInstance);
  }

  createInstance($el);
  return $el;
}

export async function createInstance(
  $el: RuntimeInternals
): Promise<RuntimeInternals> {
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
