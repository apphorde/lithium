export type AnyFunction = (...args: any[]) => any;

export type PropOptions<T = any> = {
  default?: T | (() => T);
};

export type RuntimeContext = {
  dom: DocumentFragment;
  element: any;
  context: any;
  mount: AnyFunction[];
  update: AnyFunction[];
  unmount: AnyFunction[];
  props: Record<PropertyKey, any>;
  refs: Record<PropertyKey, any>;
};

export type MountOptions = {
  template: HTMLTemplateElement;
  setup?: Function;
  styles?: CSSStyleSheet[];
  shadowDom?: boolean | string | ShadowRootInit;
};

export type DefineComponentOptions = MountOptions & {
  name: string;
  template: HTMLTemplateElement | string;
};
