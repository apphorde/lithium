interface Scope {
  run<T>(name: string, args?: any[]): T;
}

let uid = 1;
const $properties = Symbol();
const $expressions = Symbol();
const $source = Symbol();
const identity = (f) => f;

export function createScope(parent?: Scope): Scope {
  const properties = parent ? parent[$properties].slice() : [];
  const expressions = parent ? { ...parent[$expressions] } : {};
  const source = {};

  return new Proxy(
    {},
    {
      get(_t, p) {
        if (p === $properties) {
          return properties;
        }

        if (p === $expressions) {
          return expressions;
        }

        if (p === $source) {
          return source;
        }
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

  return name;
}

export function addProperty(scope: Scope, property: string) {
  scope[$properties].push(property);
}

export function addProperties(scope: Scope, properties: string[]) {
  scope[$properties].push(...properties);
}

export function compile(scope: Scope): void {
  const name = "scope" + uid++;
  const code = [`function ${name}(__s, __u) {`];
  const functionMap = scope[$expressions];
  const refs: string[] = scope[$properties];
  const keys = Object.keys(functionMap);

  for (const fn of keys) {
    const exp = functionMap[fn][0];
    const args = functionMap[fn][1] || "";
    const accessors = refs
      .filter((r) => exp.includes(r))
      .map((ref) => `const ${ref} = __u(__s.${ref});`)
      .join(",");

    code.push(
      `${
        fn.includes("await") ? "async " : ""
      } function ${fn} (${args}) { ${accessors} return ${exp} } `
    );
  }

  code.push(`return { ${keys.join(",")} }; }`);
  const fn = Function("return " + code.join("\n"))();
  scope[$source].fn = fn;
  scope[$source].source = code.join("\n");
}

export function configure(scope: Scope, options: { unwrap: any }) {
  scope[$source].unwrap = options.unwrap;
}

export function bind(scope: Scope, context: any) {
  const scopeSource = scope[$source];
  return scopeSource.fn(context, scopeSource.unwrap || identity);
}

export function getSource(scope: Scope) {
  return scope[$source].source;
}
