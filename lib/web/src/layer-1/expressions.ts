import { getCurrentInstance } from "../layer-0/stack.js";
import { AnyFunction } from "../layer-0/types.js";
import { unref } from "../layer-0/reactive.js";

const fnCache = new Map();
const domParser = new DOMParser();
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

export function compileExpression(
  expression: string,
  args: string[] = []
): AnyFunction {
  const { state, stateKeys } = getCurrentInstance();
  const usedKeys = stateKeys.filter((k) => expression.includes(k));
  const propertiesFromState = usedKeys.length
    ? usedKeys
        .map((stateKey) => `const ${stateKey} = __u(__s.${stateKey})`)
        .join(";") + ";"
    : "";

  const code = propertiesFromState + `\nreturn ${expression}`;
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

  return fn.bind(state, state, unref);
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
