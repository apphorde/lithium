import type {
  ChildNode,
  DocumentNode,
  ElementNode,
  ParserNode,
  TextNode,
} from "@lithium/html-parser";
import type { FunctionDeclaration, VariableDeclaration } from "acorn";
import { parse as parseHTML, pack } from "@lithium/html-parser";
import { parse as parseJS } from "acorn@8.12.1";

const doc: DocumentNode = { type: "document", docType: "html", children: [] };

export function findSetupNode(nodes: DocumentNode): ElementNode {
  return nodes.children.find(
    (n) =>
      n.type === "element" &&
      n.tag === "script" &&
      n.attributes.some(
        (a) => (a.name === "type" && a.value === "setup") || a.name === "setup"
      )
  ) as ElementNode;
}

export function getSetupCode(nodes: DocumentNode): string {
  const setupNode = findSetupNode(nodes);
  const setupSource =
    setupNode?.children.find((s: ChildNode) => s.type === "text").text ?? "";

  if (!setupSource) {
    return "export default function defineComponent(){ return {}; }";
  }

  const ast = parseJS(setupSource, {
    ecmaVersion: 2023,
    sourceType: "module",
  });

  const startOfSetupCode = ast.body.reduce(
    (at, n) => (n.type === "ImportDeclaration" ? Math.max(at, n.end) : at),
    0
  );
  const imports = setupSource.slice(0, startOfSetupCode);
  const setupCode = setupSource.slice(startOfSetupCode);

  const topLevelNodes: Array<FunctionDeclaration | VariableDeclaration> =
    ast.body.filter(
      (node) =>
        node.type == "VariableDeclaration" ||
        node.type === "FunctionDeclaration"
    );

  const ids = topLevelNodes.flatMap((node) =>
    "id" in node
      ? (<FunctionDeclaration>node).id.name
      : (<VariableDeclaration>node).declarations.map((d) => (<any>d).id.name)
  );
  return (
    imports +
    "\nexport default function defineComponent($el, $dom) {  \n" +
    setupCode.trim() +
    "\nreturn { " +
    ids.join(", ") +
    " };}"
  );
}

export function getTemplateNodes(nodes: DocumentNode) {
  const template = nodes.children.find(
    (n) => n.type === "element" && n.tag === "template"
  );

  const styles = nodes.children.find(
    (n) => n.type === "element" && n.tag === "style"
  ) as ElementNode;

  if (isElement(template) && template.children.length) {
    const d = { ...doc, children: [...template.children] };

    if (styles) {
      d.children.push(styles);
      const css = styles.children[0] as TextNode;
      css.text = css.text.replace(/^\s+/gm, "");
    }

    return JSON.stringify(pack(d));
  }

  return JSON.stringify(pack(doc));
}

export function getComponentCode({ template, setup, name }) {
  const s = `import {createComponent} from "@lithium/web";
${setup}
const __t = ${template};
`;

  if (name) {
    return (
      s +
      `createComponent('${name}', { setup: defineComponent, template: __t });`
    );
  }

  return (
    s +
    `export function register(name) {
    createComponent(name, { setup: defineComponent, template: __t });
  }
`
  );
}

export function normalize<T extends ParserNode>(node: T) {
  if ("children" in node) {
    node.children = node.children.filter((child) => {
      if (child.type === "text" && child.text.trim() === "") {
        return false;
      }

      normalize(child as ElementNode | DocumentNode);
      return true;
    });
  }

  return node;
}

export function parseSFC(source: string) {
  const parsed = normalize(parseHTML(source));
  const setup = getSetupCode(parsed);
  const template = getTemplateNodes(parsed);

  return { template, setup };
}

function isElement(node: any): node is ElementNode {
  return node && "children" in node;
}
