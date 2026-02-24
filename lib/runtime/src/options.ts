const options = {
  debugEnabled: false,
  useModuleExpressions: false,
  cachedTemplateFor: false,
};

type OptionKey = keyof typeof options;

export function setOption<T extends OptionKey>(option: T, value: (typeof options)[T]) {
  options[option] = value;
}

export function getOption<T extends OptionKey>(option: T): (typeof options)[T] {
  return options[option];
}
