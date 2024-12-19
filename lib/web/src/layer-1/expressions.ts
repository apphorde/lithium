import { getCurrentInstance } from "../layer-0/stack.js";
import { AnyFunction } from "../layer-0/types.js";
import { unref } from "../layer-0/reactive.js";
import { getOption } from "../layer-0/options.js";

const fnCache = new Map();
const domParser = new DOMParser();
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

let uid = 1;

export function compileExpression(
  expression: string,
  args: string[] = []
): AnyFunction {
  const { state, stateKeys } = getCurrentInstance();
  const propertiesFromState =
    stateKeys
      .map((stateKey) => `const ${stateKey} = __u(__s.${stateKey})`)
      .join(";") + ";";

  const code = propertiesFromState + `\nreturn ${expression}`;
  const cacheKey = code + args;
  let fn = fnCache.get(cacheKey);

  if (fn) {
    return fn.bind(state, state, unref);
  }

  const parsed = domParser.parseFromString(code, "text/html");
  const finalCode = parsed.body.innerText.trim();

  if (getOption("exportedExpressions")) {
    const functionName = "__f" + uid++;
    const parts = [
      "window." + functionName + " = ",
      expression.includes("await ") ? "async " : "",
      `function (`,
      ["__s", "__u", ...args].join(","),
      ") {",
      finalCode,
      "}",
    ];

    const tag = document.createElement("script");
    tag.append(document.createTextNode(parts.join("")));
    document.head.append(tag);

    return (...args) => {
      const fn = window[functionName];
      delete window[functionName];
      fnCache.set(cacheKey, fn);

      return fn.call(state, state, unref, ...args);
    };
  }

  const functionType = expression.includes("await ") ? AsyncFunction : Function;
  fn = functionType(...["__s", "__u", ...args], finalCode);
  fnCache.set(cacheKey, fn);

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
