import type { ReactiveContext } from "@lithium/reactive";

export interface RuntimeInfo {
  shadowDom: ShadowRootInit | boolean;
  reactive: ReactiveContext;
  element: Element;
  props: any;
  stylesheets: Array<[string, string, boolean]>;
  scripts: Array<[string, string, boolean]>;
  state: any;
  stateKeys: string[];
  stateArgs: any[];
  template: any[];
  setup: Function;
  init: VoidFunction | null;
  destroy: VoidFunction | null;
}

export interface RuntimeDefinitions {
  setup: Function;
  template: any[];
  shadowDom: any;
}

export type AnyFunction = (...args: any) => any;
