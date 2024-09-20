export interface RuntimeInfo {
  shadowDom: ShadowRootInit | boolean;
  reactive: ReactiveContext;
  element: Element;
  props: any;
  stylesheets: string[];
  scripts: string[];
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

