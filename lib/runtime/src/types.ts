import { ReactiveContext, type Ref } from "@li3/reactive";

export type LifeCycleFunction = (runtime: LifeCycleObject) => void;
export type UpdateLifeCycleFunction = (
  runtime: LifeCycleObject,
  property: string,
  oldValue: any,
  newValue: any
) => void;

export interface LifeCycleObject {
  element: Element | DocumentFragment;
  template: HTMLTemplateElement | null;
  state: any;
}

export interface CreateRuntimeOptions {
  element: Element | DocumentFragment;
  setup?: Function;
  template?: HTMLTemplateElement | string;
  shadowDom?: ShadowRootInit | string;
  initialValues?: any;
  parent?: RuntimeContext;
}

export class RuntimeContext {
  static readonly extensions: AnyFunction[] = [];
  static use(fn: AnyFunction) {
    RuntimeContext.extensions.push(fn);
  }

  constructor(props: CreateRuntimeOptions) {
    for (const f of RuntimeContext.extensions) {
      Object.assign(this, f());
    }

    Object.assign(
      this,
      RuntimeContext.extensions.map(f => f()),
      {
        state: {},
        stateKeys: [],
        parent: null,
        props: {},
        initialValues: {},

        init: [],
        update: [],
        destroy: [],
        view: {},

        hostClasses: [],
        reactive: new ReactiveContext(),
      },
      props
    );
  }

  shadowDom?: ShadowRootInit;
  element: Element | DocumentFragment;
  setup: Function;
  template: HTMLTemplateElement | null;
  reactive: ReactiveContext;
  stylesheets: Array<string>;
  scripts: Array<string>;
  stateKeys: string[];
  state: any;
  initialValues: any;
  view: any;
  props: Record<string, Ref<any>>;
  parent?: RuntimeContext;

  init: Array<LifeCycleFunction>;
  update: Array<UpdateLifeCycleFunction>;
  destroy: Array<LifeCycleFunction>;

  hostClasses: string[];
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
