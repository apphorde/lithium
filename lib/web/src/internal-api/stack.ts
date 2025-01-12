import type { RuntimeInternals } from "./types.js";

const stack: RuntimeInternals[] = [];

export function push(item: RuntimeInternals) {
  return stack.push(item);
}

export function pop() {
  return stack.pop();
}

export function getCurrentInstance(): RuntimeInternals {
  return stack[stack.length - 1];
}
