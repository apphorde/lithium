const options = {
  asyncMount: true,
};

export function setOption<T extends keyof typeof options>(
  option: T,
  value: (typeof options)[T]
) {
  options[option] = value;
}

export function getOption<T extends keyof typeof options>(option: T) {
  return options[option];
}