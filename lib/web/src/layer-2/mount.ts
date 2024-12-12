import { ReactiveContext } from "@lithium/reactive";
import { plugins } from "../layer-0/plugin.js";
import { createState } from "../layer-0/reactive.js";
import { push, pop } from "../layer-0/stack.js";
import { createDom } from "../layer-1/dom.js";
import type {
  ComponentDefinitions,
  RuntimeInternals,
} from "../layer-0/types.js";

export const noop = () => {};
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
    init: null,
    destroy: null,
    reactive: new ReactiveContext(),
  };

  return Promise.resolve($el).then(createInstance);
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
      $el.destroy && $el.destroy();
    };

    plugins.apply("init", [$el]);

    if ($el.init) {
      $el.init($el);
    }
  } catch (error) {
    console.log("Failed to initialize component!", this, error);
  }

  pop();

  return $el;
}
