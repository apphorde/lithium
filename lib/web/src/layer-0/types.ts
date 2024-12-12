import { ReactiveContext } from "@lithium/reactive";

export interface RuntimeProperties {
  element: Element | DocumentFragment;
  state: any;
  template: HTMLTemplateElement | any[];
}

export interface RuntimeInternals extends RuntimeProperties {
  shadowDom?: ShadowRootInit;
  reactive: ReactiveContext;
  props: any;
  stylesheets: Array<[string, string, boolean]>;
  scripts: Array<[string, string, boolean]>;
  parent: any;
  stateKeys: string[];
  setup: Function;
  init: (runtime: RuntimeProperties) => void | null;
  destroy: VoidFunction | null;
}

export interface ComponentDefinitions {
  setup?: Function;
  template: any[] | HTMLTemplateElement;
  shadowDom?: ShadowRootInit;
}

export type EventEmitter = (event: string, detail: any) => void;
export type AnyFunction = (...args: any) => any;

export interface Attribute {
  name: string;
  value: string;
}
