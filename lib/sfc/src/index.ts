import type { DocumentNode, ElementNode, ParserNode } from "@li3/html-parser";
import type { FunctionDeclaration, VariableDeclaration } from "acorn";
import { parse as parseHTML, pack } from "@li3/html-parser";
import { parse as parseJS } from "acorn";

const doc: DocumentNode = { type: "document", docType: "html", children: [] };
const NO_SETUP = "export default function defineComponent(){return {};}";
const EMPTY_NODE: ElementNode = {
  type: "element",
  selfClose: false,
  tag: "",
  children: [],
  attributes: [],
};
const EMPTY_TEMPLATE = JSON.stringify(pack(doc));

export function findNode(nodes: DocumentNode, tag: string): ElementNode {
  return nodes.children.find(
    (n) => n.type === "element" && n.tag === tag
  ) as ElementNode;
}

export function getSetupCode(setupNode: ElementNode): string {
  const setupSource =
    setupNode.children.find((s) => s.type === "text")?.text || "";

  if (!setupSource) {
    return NO_SETUP;
  }

  const ast = parseJS(setupSource, {
    ecmaVersion: 2023,
    sourceType: "module",
  });

  const startOfSetupCode = ast.body.reduce(
    (at, n) => (n.type === "ImportDeclaration" ? Math.max(at, n.end) : at),
    0
  );
  const endOfSetupCode =
    ast.body.find((n) => n.type === "ExportNamedDeclaration")?.start || 0;
  const imports = setupSource.slice(0, startOfSetupCode);
  const setupCode = endOfSetupCode
    ? setupSource.slice(startOfSetupCode, endOfSetupCode)
    : setupSource.slice(startOfSetupCode);
  const exports = endOfSetupCode
    ? "\n" + setupSource.slice(endOfSetupCode)
    : "";

  const topLevelNodes: Array<FunctionDeclaration | VariableDeclaration> =
    ast.body.filter(
      (node) =>
        node.type == "VariableDeclaration" ||
        node.type === "FunctionDeclaration"
    );

  const ids = topLevelNodes.flatMap((node) =>
    "id" in node
      ? (node as FunctionDeclaration).id.name
      : (node as VariableDeclaration).declarations.map(
          (d) => (d as any).id.name
        )
  );

  const combinedCode =
    imports +
    "\nexport function defineComponent($el, $dom) {  \n" +
    setupCode.trim() +
    "\nreturn { " +
    ids.join(", ") +
    " };}" +
    exports;

  return combinedCode;
}

export function getTemplateCode(template: ElementNode) {
  if (!template.children.length) {
    return EMPTY_TEMPLATE;
  }

  return JSON.stringify(pack({ ...doc, children: [...template.children] }));
}

export function getComponentCode(
  name,
  { template, setup, shadowDom },
  withExport = true
) {
  return `import {createComponent} from "@li3/web";
${setup}

const __s = ${shadowDom || "false"};
const __t = ${template};
const __c = { setup: defineComponent, template: __t, shadowDom: __s };

createComponent('${name}', __c);
${withExport ? "export default __c;" : ""}
`;
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
  const parsedHtml = normalize(parseHTML(source));
  const setupNode = findNode(parsedHtml, "script") || EMPTY_NODE;
  const templateNode = findNode(parsedHtml, "template") || EMPTY_NODE;
  const styleNode = findNode(parsedHtml, "style");

  if (styleNode) {
    templateNode.children.push(styleNode);
  }

  const setup = getSetupCode(setupNode);
  const template = getTemplateCode(templateNode);
  const shadowDomOption = templateNode.attributes.find(
    (a) => a.name === "shadow-dom" || a.name === "shadowdom"
  );

  const shadowDom = !shadowDomOption
    ? false
    : shadowDomOption.value.startsWith("{")
    ? JSON.parse(shadowDomOption.value)
    : { mode: shadowDomOption.value };

  return {
    template,
    setup,
    shadowDom: shadowDom ? JSON.stringify(shadowDom) : "false",
  };
}

export async function loadComponent(name, url: string | URL) {
  const req = await fetch(url);

  if (!req.ok) {
    throw new Error(`Failed to load component at ${url}`);
  }

  const source = await req.text();
  const parsed = parseSFC(source);
  const component = getComponentCode(name, parsed, false);
  const tag = document.createElement("script");
  tag.type = "module";
  tag.innerText = component;
  document.head.appendChild(tag);
}
