const reactiveTag = Symbol('reactive');
const unwrapTag = Symbol('unwrap');

export function canBeObserved(object: any): boolean {
  return object !== null && object !== undefined && typeof object === 'object' && !object[reactiveTag];
}

export function reactive<T extends object>(object: T, effect: VoidFunction): T {
  if (!canBeObserved(object)) {
    return object;
  }

  const values = Object.entries(object);
  for (const [key, next] of values) {
    if (typeof next === 'object' && next !== null) {
      (object as any)[key] = reactive(next, effect);
    }
  }

  return new Proxy(object, {
    get(target, p) {
      if (p === reactiveTag) {
        return true;
      }

      if (p === unwrapTag) {
        return object;
      }

      return target[p];
    },

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

/**
 * Unwraps a reactive object to its original form.
 * This is useful when you want to access the original object
 * without the reactive proxy.
 *
 * @param {object} object The proxy object to unwrap
 * @returns {object} the original object
 */
export function unwrap<T extends object>(object: T): T {
  if (object === null || object === undefined) {
    return object;
  }

  if (object[unwrapTag]) {
    return object[unwrapTag];
  }

  return object;
}
