/**
 * A scope has a state object with properties that do not change
 * A scope has expressions that can be executed against the state
 * Once a scope is compiled, it is immutable.
 *
 *   const test = createScope();
 *   addProperty(test, "name", "value");
 *   const getName = addExpression(test, "name");
 *   const compiled = compile(test);
 *   const s = injectScope(test);
 *   console.log(s.f1, f1('foo'));
 */

interface Scope {
  run<T>(name: string, args?: any[]): T;
}

let uid = 1;
const $state = Symbol();
const $expressions = Symbol();
const $source = Symbol();

export function createScope(): Scope {
  const state = {};
  const expressions = {};
  const source = {};

  return new Proxy(
    {},
    {
      get(_t, p) {
        if (p === $state) {
          return state;
        }

        if (p === $expressions) {
          return expressions;
        }

        if (p === $source) {
          return source;
        }

        return state[p];
      },
    }
  ) as Scope;
}

export function addExpression(
  scope: Scope,
  expression: string,
  args?: string[]
) {
  const name = "f" + uid++;
  const e = scope[$expressions];
  e[name] = [expression, args];

  return function (...args: any[]) {
    return e[name].apply(null, args);
  };
}

export function addProperty(
  scope: Scope,
  property: string | symbol,
  value: any
) {
  const s = scope[$state];

  if (Object.isFrozen(s)) {
    throw new Error("State is immutable");
  }

  s[property] = value;
}

export function compile(scope: Scope) {
  const e = scope[$expressions];
  const s = scope[$state];
  const refs = Object.keys(s);
  const keys = Object.keys(e);
  const name = "scope" + uid++;
  const code = [`function ${name}(state) {`];

  Object.freeze(s);

  for (const fn of keys) {
    const exp = e[fn][0];
    const args = e[fn][1] || "";
    const accessors = `const {${refs
      .filter((r) => exp.includes(r))
      .join(",")}} = state;`;

    code.push(
      `${
        fn.includes("await") ? "async " : ""
      } function ${fn} (${args}) { ${accessors} return ${exp} } `
    );
  }

  code.push(`return { ${keys.join(",")} }; }`);

  scope[$source].name = name;
  scope[$source].code = code.join("\n");
}

export function clone(scope: Scope) {
  const el = document.createElement("script");
  const scopeSource = scope[$source];
  el.innerText = scopeSource.code;
  document.head.append(el);

  const f = (window as any)[scopeSource.name](scope);
  Object.assign(scope[$expressions], f);
  el.remove();
  return f;
}
