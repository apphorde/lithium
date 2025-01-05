import { getCurrentInstance } from "../layer-0/stack.js";
import { AnyFunction, RuntimeInternals } from "../layer-0/types.js";
import { unref } from "../layer-0/reactive.js";

const fnCache = new Map();
const domParser = new DOMParser();
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

function unwrap(stateKeys, state) {
  const unwrapped = Object.create(null);

  for (const key of stateKeys) {
    unwrapped[key] = unref(state[key]);
  }

  return unwrapped;
}

export function compileExpression(
  $el: RuntimeInternals,
  expression: string,
  args: string[] = []
): AnyFunction {
  const { state, stateKeys } = $el;
  const code = `
  const {${stateKeys.join(", ")}} = __u(__s);
  return ${expression}
  `;
  const cacheKey = code + args;
  let fn = fnCache.get(cacheKey);

  if (!fn) {
    const parsed = domParser.parseFromString(code, "text/html");
    const finalCode = parsed.body.innerText.trim();
    const functionType = expression.includes("await ")
      ? AsyncFunction
      : Function;

    fn = functionType(...["__s", "__u", ...args], finalCode);
    fnCache.set(cacheKey, fn);
  }

  return fn.bind(state, state, unwrap.bind(null, stateKeys));
}

export function wrapTryCatch(exp: string, fn: AnyFunction) {
  return () => {
    try {
      const v = fn();
      return unref(v);
    } catch (e) {
      console.log("Error: " + exp, e);
    }
  };
}
