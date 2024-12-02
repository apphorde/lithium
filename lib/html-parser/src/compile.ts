let _uid = 1;

function uid() {
  return "u" + _uid++;
}

export function compile(node, options, children?, context = { ns: "", vars: [] }) {
  const code = [];

  if (node.type === "document") {
    const id = uid();
    context.vars.push(`${id}=document.createDocumentFragment()`);

    const docChildren = [];
    let next;
    for (const c of node.children) {
      next = compile(c, options, docChildren, context);
      next && code.push(next);
    }

    docChildren.length && code.push(`p(${id},[${docChildren.join(",")}]);`);

    _uid = 1;
    return {
      rootElement: id,
      code:
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
        code.join(";"),
    };
  }

  if (node.type === "element") {
    const id = uid();

    if (node.tag === "svg") {
      context.ns = "s";
    }

    if (context.ns) {
      context.vars.push(`${id}=ne("${node.tag}","${context.ns}");`);
    } else {
      context.vars.push(`${id}=e("${node.tag}");`);
    }

    const bs = options?.beforeSetAttribute;
    for (const a of node.attributes) {
      const b = bs ? bs(id, node, a) : a;

      if (!b) continue;

      const { name, value } = b;
      if (value) {
        code.push(`a(${id},"${name}",\`${value}\`);`);
      } else {
        code.push(`a(${id},"${name}");`);
      }
    }

    children.push(id);

    if (node.children.length) {
      const elChildren = [];
      let next;
      for (const c of node.children) {
        next = compile(c, options, elChildren, context);
        next && code.push(next);
      }

      elChildren.length && code.push(`p(${id},[${elChildren.join(",")}]);`);
    }

    if (node.tag === "svg") {
      context.ns = "";
    }

    return code.join("");
  }

  if (node.type === "text" && node.text.trim()) {
    const id = uid();
    context.vars.push(`${id}=t(${JSON.stringify(node.text)})`);
    children.push(id);
  }
}
