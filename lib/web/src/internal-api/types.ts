import { ReactiveContext } from "@li3/reactive";

export type LifeCycleFunction = (runtime: LifeCycleObject) => void;
export type UpdateLifeCycleFunction = (
  runtime: LifeCycleObject,
  property: string,
  oldValue: any,
  newValue: any
) => void;

export interface LifeCycleObject {
  element: Element | DocumentFragment;
  template: HTMLTemplateElement;
  state: any;
}

export interface CreateInstanceProperties {
  element: Element | DocumentFragment;
  setup?: Function;
  template?: HTMLTemplateElement | string;
  shadowDom?: ShadowRootInit | string;
  initialValues?: any;
  parent?: any;
}

export interface RuntimeInternals extends CreateInstanceProperties {
  setup: Function;
  template: HTMLTemplateElement | null;
  reactive: ReactiveContext;
  stylesheets: Array<string>;
  scripts: Array<string>;
  stateKeys: string[];
  state: any;

  init: Array<LifeCycleFunction>;
  update: Array<UpdateLifeCycleFunction>;
  destroy: Array<LifeCycleFunction>;
}

export interface ComponentDefinition {
  setup?: Function;
  template?: HTMLTemplateElement | string;
  shadowDom?: ShadowRootInit;
}

export type EventEmitFunction = (event: string, detail: any) => void;
export type AnyFunction = (...args: any) => any;

export interface Attribute {
  name: string;
  value: string;
}
