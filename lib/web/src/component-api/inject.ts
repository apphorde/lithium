import { getCurrentInstance } from "../internal-api/stack.js";

type InjectionEvent<T> = CustomEvent & { result?: T };

export function provide<T>(token: Symbol, provider): void {
  const fn = typeof provider === "function" ? provider : () => provider;
  const { element } = getCurrentInstance();

  element.addEventListener("$inject", (e: InjectionEvent<T>) => {
    if (e.detail === token) {
      e.result = fn();
      e.stopPropagation();
    }
  });
}

export function inject<T>(token: any) {
  const { element } = getCurrentInstance();
  const event = new CustomEvent("$inject", {
    detail: token,
    bubbles: true,
  }) as CustomEvent & { result: T };

  element.dispatchEvent(event);

  const result = event.result;

  if (!result) {
    throw new Error("Injectable not found: " + token);
  }

  return result;
}
