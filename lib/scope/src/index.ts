import { type RuntimeContext, type AnyFunction, getOption } from '@li3/runtime';
import { computedRef } from '@li3/reactive';

const fnCache = new Map();
const modCache = new Map();

export function compileExpression($el: RuntimeContext, expression: string, args: string[] = []) {
  if (getOption('useModuleExpressions')) {
    return compileExpressionBlob($el, expression, args);
  }

  return compileExpressionEval($el, expression, args);
}

export function compileExpressionBlob($el: RuntimeContext, expression: string, args: string[] = []): AnyFunction {
  const code = `export default function(${args.join(', ')}) { ${createFunctionBody($el, expression)} }`;

  if (!modCache.has(code)) {
    modCache.set(code, createBlobModule(code));
  }

  const mod = modCache.get(code);

  return async function (...args: any[]) {
    const fn = await mod;
    return fn.default.apply($el.view, args);
  };
}

export function compileExpressionEval($el: RuntimeContext, expression: string, args: string[] = []): AnyFunction {
  const code = createFunctionBody($el, expression);
  const cacheKey = code + args;
  let fn = fnCache.get(cacheKey);

  if (!fn) {
    fn = Function(...args, code);
    fnCache.set(cacheKey, fn);
  }

  return (...args: any[]) => fn.apply($el.view, args);
}

export function computedEffect<T>($el: RuntimeContext, expression: string, effect: (v: T) => void) {
  const fn = compileExpressionEval($el, expression);
  const computed = wrapInTryCatch(expression, fn);
  const ref = computedRef(computed, effect);
  return ref;
}

export function createBlobModule(code: string, type = 'text/javascript') {
  const blob = new Blob([code], { type });
  const url = URL.createObjectURL(blob);
  const modPromise = import(url);
  modPromise.then(() => URL.revokeObjectURL(url));

  return modPromise;
}

function createFunctionBody<T extends RuntimeContext>($el: T, expression: string) {
  const keys = $el.stateKeys.filter((key) => expression.includes(key)).join(', ');

  return `
    const {${keys}} = this;
    return ${expression};
  `;
}

function wrapInTryCatch(source: string, fn: AnyFunction) {
  if (getOption('debugEnabled')) {
    return () => fn();
  }

  return () => {
    try {
      return fn();
    } catch (e) {
      console.log('Error: ' + source, e);
    }
  };
}
