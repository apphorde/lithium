import type { RuntimeContext } from './types.js';

const stack: RuntimeContext[] = [];

export function push(item: RuntimeContext) {
  return stack.push(item);
}

export function pop() {
  return stack.pop();
}

export function getCurrentContext(): RuntimeContext {
  return stack[stack.length - 1];
}
