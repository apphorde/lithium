import { getCurrentInstance } from "../layer-0/stack.js";
import { AnyFunction, RuntimeInternals } from "../layer-0/types.js";
import { unref } from "../layer-0/reactive.js";
import { getOption } from "../layer-0/options.js";

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
  if (getOption("useModuleExpressions")) {
    return compileExpressionBlob($el, expression, args);
  }

  return compileExpressionEval($el, expression, args);
}

let uid = 1;
export function compileExpressionBlob(
  $el: RuntimeInternals,
  expression: string,
  args: string[] = []
) {
  const { state, stateKeys } = $el;
  const fname = `__f${uid++}`;
  const fargs = ["__s", ...args].join(", ");
  const fasync = expression.includes("await ") ? "async " : "";
  const code = `window.${fname} = ${fasync}function(${fargs}) {
    const {${stateKeys.join(", ")}} = __s;
    return ${expression};
  }
  `;

  const blob = new Blob([code], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const script = document.createElement("script");
  script.onload = () => script.remove();
  script.src = url;
  script.type = "module";
  document.head.append(script);

  return function (...args: any[]) {
    return window[fname](unwrap(stateKeys, state), ...args);
  };
}

export function compileExpressionEval(
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
    let finalCode = code;

    if (getOption("useDomParser")) {
      const parsed = domParser.parseFromString(code, "text/html");
      finalCode = parsed.body.innerText.trim();
    }

    const functionType = expression.includes("await ")
      ? AsyncFunction
      : Function;

    fn = functionType(...["__s", "__u", ...args], finalCode);
    fnCache.set(cacheKey, fn);
  }

  return fn.bind(state, state, unwrap.bind(null, stateKeys));
}

export function wrapTryCatch(exp: string, fn: AnyFunction) {
  if (getOption("debugEnabled")) {
    return () => unref(fn());
  }

  return () => {
    try {
      const v = fn();
      return unref(v);
    } catch (e) {
      console.log("Error: " + exp, e);
    }
  };
}
