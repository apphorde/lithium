import { RuntimeContext, type AnyFunction, getOption } from '@li3/runtime';

const fnCache = new Map();
const domParser = new DOMParser();
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

export function compileExpression($el: RuntimeContext, expression: string, args: string[] = []): AnyFunction {
  try {
    return compileExpressionBlob($el, expression, args);
  } catch {
    return compileExpressionEval($el, expression, args);
  }
}

export function createBlobModule(code: string, type = "text/javascript") {
  const blob = new Blob([code], { type });
  const url = URL.createObjectURL(blob);
  const modPromise = import(url);
  modPromise.then(() => URL.revokeObjectURL(url));
  return modPromise;
}

const modCache = new Map();

export function compileExpressionBlob($el: RuntimeContext, expression: string, args: string[] = []) {
  const fargs = ["__s", ...args].join(", ");
  const fasync = expression.includes("await ") ? "async " : "";
  const code = `export default ${fasync}function(${fargs}) {
    const {${$el.stateKeys.join(", ")}} = __s;
    return ${expression};
  }`;

  if (!modCache.has(code)) {
    modCache.set(code, createBlobModule(code));
  }

  const mod = modCache.get(code);

  return async function (...args: any[]) {
    const fn = await mod;
    return fn.default($el.view, ...args);
  };
}

export function compileExpressionEval($el: RuntimeContext, expression: string, args: string[] = []): AnyFunction {
  const code = `
  const {${$el.stateKeys.join(", ")}} = __u(__s);
  return ${expression}
  `;
  const cacheKey = code + args;
  let fn = fnCache.get(cacheKey);

  if (!fn) {
    let finalCode = code;

    if (getOption("useDomParser")) {
      const parsed = domParser.parseFromString(code, "text/html");
      finalCode = parsed.body.innerText.trim();
    }

    const functionType = expression.includes("await ") ? AsyncFunction : Function;

    fn = functionType(...["__s", ...args, finalCode]);
    fnCache.set(cacheKey, fn);
  }

  return fn.bind(null, $el.view);
}

export function wrapTryCatch(exp: string, fn: AnyFunction) {
  if (getOption("debugEnabled")) {
    return () => fn();
  }

  return () => {
    try {
      return fn();
    } catch (e) {
      console.log("Error: " + exp, e);
    }
  };
}
