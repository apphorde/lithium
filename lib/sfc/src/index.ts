import type { DocumentNode, ElementNode } from "@li3/html-parser";
import type { FunctionDeclaration, VariableDeclaration } from "acorn";
import { parse as parseHTML, normalize, serialize } from "@li3/html-parser";
import { parse as parseJS } from "acorn";

function findNode(nodes: DocumentNode, tag: string): ElementNode {
  return nodes.children.find(
    (n) => n.type === "element" && n.tag === tag
  ) as ElementNode;
}

function getSetupCode(setupNode: ElementNode): string {
  const setupSource =
    setupNode.children.find((s) => s.type === "text")?.text || "";

  if (!setupSource) {
    return "";
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

export function getComponentCode(
  name: string,
  { template, setup, shadowDom },
  withExport = true
) {
  return `import {createComponent} from "@li3/web";
${setup || "const defineComponent = undefined;"}

const __s = ${shadowDom || "false"};
const __t = ${template || "''"};
const __c = { setup: defineComponent, template: __t, shadowDom: __s };

createComponent('${name}', __c);
${withExport ? "export default __c;" : ""}
`;
}

export function parseSFC(source: string) {
  const parsedHtml = normalize(parseHTML(source));
  const setupNode = findNode(parsedHtml, "script");
  const templateNode = findNode(parsedHtml, "template");
  const styleNode = findNode(parsedHtml, "style");

  if (styleNode && templateNode) {
    templateNode.children.push(styleNode);
  }

  const setup = getSetupCode(setupNode);
  const shadowDomOption = templateNode.attributes.find(
    (a) => a.name === "shadow-dom" || a.name === "shadowdom"
  );

  const shadowDom = !shadowDomOption
    ? false
    : shadowDomOption.value.startsWith("{")
    ? JSON.parse(shadowDomOption.value)
    : { mode: shadowDomOption.value };

  const sfc: any = {};

  if (setup) {
    sfc.setup = setup;
  }

  if (templateNode) {
    sfc.template = JSON.stringify(
      templateNode.children.map(serialize).join("")
    );
  }

  if (shadowDom) {
    sfc.shadowDom = JSON.stringify(shadowDom);
  }

  return sfc;
}

export async function loadComponent(name: string, url: string | URL) {
  const req = await fetch(url);

  if (!req.ok) {
    throw new Error(`Failed to load component at ${url}`);
  }

  const source = await req.text();
  const parsed = parseSFC(source);

  return getComponentCode(name, parsed, false);
}
