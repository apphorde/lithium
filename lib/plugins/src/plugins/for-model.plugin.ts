import { effect, type Signal } from "@li3/reactive";
import { onVisitAttribute, RuntimeContext } from "@li3/runtime";

onVisitAttribute(
  ($el: RuntimeContext, node: Element, attribute: string, value: string) => {
    if (attribute === "for-model") {
      connectDataModel($el, node, value);
    }
  }
);

export function connectDataModel(
  $el: RuntimeContext,
  element: Element,
  model: string
): void {
  const target: Signal<string> = $el.state[model];

  if (!target) {
    throw new Error(
      `Model "${model}" not found in state. Did you forget to define it?`
    );
  }

  effect(() => {
    const value = target.value;
    const currentValue = (element as HTMLInputElement).value;

    if (value !== currentValue) {
      (element as HTMLInputElement).value = value;
    }
  });

  const updateValue = () => {
    target.value = (element as HTMLInputElement).value;
  };

  element.addEventListener("input", updateValue);
  element.addEventListener("change", updateValue);
}
