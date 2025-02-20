const options: Record<string, boolean> = {
  debugEnabled: false,
};

export function setOption<T extends keyof typeof options>(option: T, value: (typeof options)[T]) {
  options[option] = value;
}

export function getOption(option: string) {
  return options[option];
}
