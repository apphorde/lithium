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
  stylesheets: Array<string>;
  scripts: Array<string>;
  parent: any;
  stateKeys: string[];
  setup: Function;
  init: Array<(runtime: RuntimeProperties) => void>;
  destroy: Array<(runtime: RuntimeProperties) => void>;
}

export interface ComponentDefinitions {
  setup?: Function;
  template: any[] | HTMLTemplateElement;
  shadowDom?: ShadowRootInit;
}

export type EventEmitFunction = (event: string, detail: any) => void;
export type AnyFunction = (...args: any) => any;

export interface Attribute {
  name: string;
  value: string;
}
