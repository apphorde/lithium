export interface ComponentInitialization {
  shadowDom?: ShadowRootInit;
  template: HTMLTemplateElement | any[];
  setup: Function;
  stylesheets: Array<[string, string, boolean]>;
  scripts: Array<[string, string, boolean]>;
  props: any;
}

export interface ComponentRuntime extends ComponentInitialization {
  element: Element | DocumentFragment;
  state: any;
  stateKeys: string[];
  parent: any;
  init: VoidFunction | null;
  destroy: VoidFunction | null;
}


export interface ComponentDefinitions {
  setup?: Function;
  template: HTMLTemplateElement | any[];
  shadowDom?: ShadowRootInit;
}