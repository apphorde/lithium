import { ReactiveContext, Ref } from "@lithium/reactive";
export interface RuntimeInfo {
    reactive: ReactiveContext;
    element: Element;
    $state: any;
    $stateKeys: string[];
    $stateArgs: any[];
    nodes: any;
    componentSetup: Function;
    init: VoidFunction | null;
    destroy: VoidFunction | null;
}
type AnyFunction = (...args: any) => any;
export declare const noop: () => void;
export declare const DefineComponent: unique symbol;
export declare function createComponent(name: string, { setup, template }: {
    setup: AnyFunction;
    template: any;
}): void;
export declare class DOM {
    static attachHandler(el: EventTarget, eventName: string, handler: AnyFunction, options?: any): void;
    static emitEvent(element: Element, event: string, detail: any): void;
    static setProperty(el: Element, property: string, value: any): void;
    static setClassName(el: Element, classNames: string, value: any): void;
    static setStyle(el: HTMLElement, key: string, value: any): void;
    static setText(el: Text, text: any): void;
    static defineEvent(el: Element, name: string): void;
    static compileExpression(expression: string, args?: string[]): AnyFunction;
    static materialize(node: any, visitor: (el: any, attr?: any) => void, context?: {
        ns?: any;
    }): Element | Text | DocumentFragment | Comment;
    static setAttribute(el: Element, attribute: string, value: boolean): void;
}
export declare class Runtime {
    static init($el: RuntimeInfo): Promise<void>;
    static createInstance(): void;
    static createDom(): void;
    static compileExpression(expression: string, context: any): AnyFunction;
    static createBindings(state: any, element: {
        nodeType: any;
        TEXT_NODE: any;
        ELEMENT_NODE: any;
    }, attributes: any): void;
    static createTextNodeBinding(context: any, el: Text): void;
    static createElementNodeBindings(context: any, el: any, attrs: any): void;
    static createElementNodeEventBinding(context: any, el: any, attribute: {
        slice: (arg0: number) => {
            (): any;
            new (): any;
            split: {
                (arg0: string): [any, ...any[]];
                new (): any;
            };
        };
    }, expression: any): void;
    static createElementNodeRefBinding(context: {
        [x: string]: {
            value: any;
        };
    }, el: unknown, _attribute: any, expression: string): void;
    static createElementNodeClassBinding(context: any, el: any, attribute: string, expression: any): void;
    static createElementNodeStyleBinding(context: any, el: any, attribute: string, expression: any): void;
    static createElementNodePropertyBinding(context: any, el: any, attribute: string, expression: any): void;
}
export declare function getCurrentInstance(): RuntimeInfo;
export declare function loadCss(href: string, id: string, condition: boolean): void;
export declare function loadScript(src: string, id: string, condition: boolean): void;
export declare function onInit(fn: VoidFunction): void;
export declare function onDestroy(fn: VoidFunction): void;
export declare function computed<T>(fn: () => T): Ref<T>;
export declare function defineEvents(eventNames: any): (event: string, detail: any) => void;
export declare function defineProps(props: {}): any;
export declare function watch(expression: AnyFunction, effect?: AnyFunction): void;
export declare function ref<T>(value?: T): Ref<T>;
export {};
