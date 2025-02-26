import { type Ref } from '@li3/reactive';

export type LifeCycleFunction = (runtime: LifeCycleObject) => void;
export type UpdateLifeCycleFunction = (
  runtime: LifeCycleObject,
  property: string,
  oldValue: any,
  newValue: any,
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

  constructor(options: CreateRuntimeOptions) {
    for (const f of RuntimeContext.extensions) {
      Object.assign(this, f());
    }

    Object.assign(
      this,
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
      },
    );

    // prevent empty values from breaking expected behavior of runtime properties,
    // e.g. a context value returning null instead of object/array
    const p = Object.entries(options);
    for (const [k, v] of p) {
      if (v) this[k] = v;
    }
  }

  shadowDom?: ShadowRootInit;
  element: Element | DocumentFragment;
  setup: Function;
  template: HTMLTemplateElement | null;
  stateKeys: string[];
  state: any;
  initialValues: any;
  view: any;
  props: Record<string, Ref<any>>;
  parent?: RuntimeContext;

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
