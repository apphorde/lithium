let _uid = 1;

function uid() {
  return "u" + _uid++;
}

export function compile(node, children, context = { ns: "", vars: [] }) {
  const code = [];

  if (node.type === "document") {
    const id = uid();
    context.vars.push(`${id}=document.createDocumentFragment()`);

    const h = [];
    let n;
    for (const c of node.children) {
      n = compile(c, h, context);
      n && code.push(n);
    }

    h.length && code.push(`p(${id},[${h.join(",")}]);`);

    _uid = 1;
    return (
      `const _d=document,
e=x=>_d.createElement(x),
ne=(x,n)=>_d.createElementNS(n=='s'?'http://www.w3.org/2000/svg':'',x),
t=x=>_d.createTextNode(x),
a=(e,a,b='')=>e.setAttribute(a,b),
p=(t,a)=>t.append(...a);
` +
      "let " +
      context.vars.join(",") +
      ";\n" +
      code.join("\n") +
      "return " +
      id
    );
  }

  if (node.type === "element") {
    const id = uid();

    if (node.tag === "svg") {
      context.ns = "s";
    }

    if (context.ns) {
      context.vars.push(`${id}=ne("${node.tag}","${context.ns}")`);
    } else {
      context.vars.push(`${id}=e("${node.tag}")`);
    }

    for (const { name, value } of node.attributes) {
      if (value) {
        code.push(`a(${id},"${name}",\`${value}\`)`);
      } else {
        code.push(`a(${id},"${name}")`);
      }
    }

    children.push(id);
    if (node.children.length) {
      const h = [];
      let n;
      for (const c of node.children) {
        n = compile(c, h, context);
        n && code.push(n);
      }

      h.length && code.push(`p(${id},[${h.join(",")}])`);
    }

    if (node.tag === "svg") {
      context.ns = "";
    }

    return code.join("\n");
  }

  if (node.type === "text" && node.text.trim()) {
    const id = uid();
    context.vars.push(`${id}=t(${JSON.stringify(node.text)})`);
    children.push(id);
  }
}
