const reactiveTag = Symbol('reactive');

export function canBeReactive(object: any): boolean {
  return object !== null && object !== undefined && typeof object === 'object' && !object[reactiveTag];
}

export function markAsReactive(context: any): void {
  Object.defineProperty(context, reactiveTag, {
    value: true,
    enumerable: false,
    configurable: false,
  });
}

export function reactive<T extends object>(object: T, effect: VoidFunction): T {
  if (!canBeReactive(object)) {
    return object;
  }

  markAsReactive(object);

  const values = Object.entries(object);
  for (const [key, next] of values) {
    if (typeof next === 'object' && next !== null) {
      (object as any)[key] = reactive(next, effect);
    }
  }

  return new Proxy(object, {
    set(target, p, value) {
      if ((target as any)[p] === value) {
        return false;
      }

      if (typeof value === 'object' && value !== null) {
        value = reactive(value, effect);
      }

      (target as any)[p] = value;
      effect();
      return true;
    },
    deleteProperty(target, p) {
      delete target[p];
      effect();
      return true;
    },
  });
}
