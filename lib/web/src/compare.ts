import { FF } from './feature-flags.js';
export function compare(a: any, b: any) {
  if (FF.strictCompare) {
    return a === b;
  }

  const typeA = typeof a;
  const typeB = typeof b;

  if (typeA !== typeB) {
    return false;
  }

  if (typeA === 'object') {
    if (a === null || b === null) {
      return a === b;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        return false;
      }

      for (let i = 0; i < a.length; i++) {
        if (!compare(a[i], b[i])) {
          return false;
        }
      }

      return true;
    }

    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    if (a instanceof RegExp && b instanceof RegExp) {
      return a.toString() === b.toString();
    }

    if (a instanceof Error && b instanceof Error) {
      return a.message === b.message;
    }

    return a === b;
  }

  if (typeA === 'function') {
    return String(a) === String(b);
  }

  if (Number.isNaN(a) && Number.isNaN(b)) {
    return true;
  }

  return a === b;
}
