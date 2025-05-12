const reactiveTag = Symbol("reactive");

export function canBeObserved(object: any): boolean {
  return (
    object !== null &&
    object !== undefined &&
    typeof object === "object" &&
    !object[reactiveTag]
  );
}

export function reactive<T extends object>(object: T, effect: VoidFunction): T {
  if (!canBeObserved(object)) {
    return object;
  }

  const values = Object.entries(object);
  for (const [key, next] of values) {
    if (typeof next === "object" && next !== null) {
      (object as any)[key] = reactive(next, effect);
    }
  }

  return new Proxy(object, {
    get(target, p) {
      if (p === reactiveTag) {
        return true;
      }

      return target[p];
    },

    set(target, p, value) {
      if ((target as any)[p] === value) {
        return false;
      }

      if (typeof value === "object" && value !== null) {
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
