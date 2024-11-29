import type {
  ElementNode,
  DocumentNode,
  TextNode,
  CommentNode,
  PackedChildNode,
  ChildNode,
  PackedDocumentNode,
  PackedElementNode,
  PackedCommentNode,
  PackedAttributes,
} from "./types";
import { PackedTextNode } from "./types";

const startTag = "<";
const endTag = ">";
const closeScriptTag = "</script>";
const startComment = "!--";
const docType = "!doctype";
const forwardSlash = "/";
const backSlash = "\\";
const space = " ";
const newLine = "\n";
const equals = "=";
const doubleQuote = `"`;
const implicitClose = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;

export function isSelfClosingTag(tag: string) {
  return implicitClose.test(tag);
}

export class Parser {
  index = 0;
  line = 1;
  column = 1;
  max = 0;
  root: DocumentNode = { type: "document", docType: "html", children: [] };
  currentTag: ElementNode | DocumentNode = this.root;
  stack: ElementNode[] = [this.currentTag as ElementNode];

  constructor(public html: string) {
    this.max = html.length;
  }

  parse() {
    this.iterate(() => {
      this.parseNext();

      if (this.getCurrent() === "") {
        return true;
      }
    });

    if (this.stack.length !== 1) {
      this.throwError(new SyntaxError(`Some tags are not closed: ${this.stack.slice(1).map((t: ElementNode) => t.tag)}`));
    }

    return this.root;
  }

  get position(): string {
    return `${this.line}:${this.column}`;
  }

  getNext(): string {
    return this.html.charAt(this.index + 1);
  }

  getPrevious(): string {
    return this.html.charAt(this.index - 1);
  }

  getCurrent(): string {
    return this.html.charAt(this.index);
  }

  throwError<T extends Error>(error: T) {
    const location = this.position;
    const { line, column } = this;
    const source = this.html.split("\n")[line - 1];

    Object.assign(error, {
      origin: source + "\n" + " ".repeat(column - 2) + "^",
      location: location,
    });

    throw error;
  }

  lookAhead(characterCount: number) {
    return this.html.substr(this.index, characterCount);
  }

  expectedItemError(expectedValue: string) {
    this.throwError(
      new SyntaxError(`Unexpected "${this.getCurrent()}". Expected ${expectedValue} at ${this.position}`)
    );
  }

  expect(value: string) {
    if (this.getCurrent() === value) {
      return this.skip();
    }

    this.expectedItemError(value);
  }

  iterate(fn: () => boolean | undefined) {
    let last = this.index;
    let stop = false;

    while (this.index < this.max) {
      stop = fn();

      if (stop === true) break;

      if (last === this.index) {
        this.throwError(new Error(`Infinite loop at ${this.position}`));
      }

      last = this.index;
    }
  }

  skip(amount = 1) {
    while (amount) {
      this.index++;
      amount--;

      if (this.getCurrent() === newLine) {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
    }
  }

  skipUntil(condition: () => boolean) {
    let initialPosition = this.index;
    let chars = 0;

    this.iterate(() => {
      if (condition()) {
        return true;
      }

      this.skip();
      chars++;
    });

    return this.html.substr(initialPosition, chars);
  }

  skipSpaces() {
    const condition = () => this.getCurrent() !== space && this.getCurrent() !== newLine;

    if (!condition()) {
      this.skipUntil(condition);
    }
  }

  parseTextNode() {
    const isScript = "tag" in this.currentTag && this.currentTag.tag === "script";
    const condition = !isScript
      ? () => this.getCurrent() === startTag
      : () => this.getCurrent() === startTag && this.lookAhead(closeScriptTag.length) === closeScriptTag;

    if (condition()) {
      return;
    }

    const text = this.skipUntil(condition);
    if (text) {
      this.currentTag.children.push({
        type: "text",
        text,
      });
      return true;
    }
  }

  isSelfClosingTag() {
    return this.getCurrent() === forwardSlash && this.getNext() === endTag;
  }

  isEndOfAttributes() {
    return this.getCurrent() === endTag || this.isSelfClosingTag();
  }

  parseAttributes() {
    while (true) {
      this.skipSpaces();

      if (this.isEndOfAttributes() || !this.parseAttribute()) {
        break;
      }
    }
  }

  parseAttributeName() {
    let name = "";

    this.iterate(() => {
      const char = this.getCurrent();
      if (char === newLine || char === space || char === equals || char === forwardSlash) {
        return true;
      }

      name += char;
      this.skip();
    });

    if (name) {
      return name;
    }

    this.expectedItemError("attribute name");
  }

  parseAttributeValue() {
    let value = "";
    this.expect(doubleQuote); // start quote

    if (this.getCurrent() === doubleQuote) {
      this.skip();
      return "";
    }

    this.iterate(() => {
      if (this.getCurrent() === doubleQuote && this.getPrevious() !== backSlash) {
        this.expect(doubleQuote); // end quote
        return true;
      }

      value += this.getCurrent();
      this.skip();
    });

    if (value) {
      return value;
    }

    this.expectedItemError("attribute value");
  }

  parseAttribute() {
    const name = this.parseAttributeName();

    if (!name) {
      return false;
    }

    let value = "";

    if (this.getCurrent() === equals) {
      this.skip();
      value = this.parseAttributeValue();
    }

    (this.currentTag as ElementNode).attributes.push({ name, value });

    return true;
  }

  openTag(tagName: string) {
    const newTag: ElementNode = {
      type: "element",
      tag: tagName,
      selfClose: false,
      attributes: [],
      children: [],
    };

    this.stack.push(newTag);
    this.currentTag.children.push(newTag);
    this.currentTag = newTag;
  }

  closeTag(selfClose = false) {
    (this.currentTag as ElementNode).selfClose = selfClose;
    this.stack.pop();
    this.currentTag = this.stack[this.stack.length - 1];
  }

  parseNext() {
    // closing a tag  </...>
    if (this.lookAhead(2) === startTag + forwardSlash) {
      this.skip(2);
      const tagToClose = this.skipUntil(() => this.getCurrent() === endTag).trim();

      if ((this.currentTag as ElementNode).tag !== tagToClose) {
        this.throwError(
          new SyntaxError(`Expected closing "${(this.currentTag as ElementNode).tag}", found "${tagToClose}"`)
        );
      }

      this.closeTag();
      this.skip(); // >
      return;
    }

    // starting a tag
    if (this.getCurrent() === startTag) {
      this.skip(); // <

      const tagName = this.skipUntil(() => {
        const char = this.getCurrent();

        return char === forwardSlash || char === space || char === newLine || char === endTag;
      });

      if (tagName === startComment) {
        const comment = this.skipUntil(() => this.getCurrent() === "-" && this.getNext() === "-");
        this.currentTag.children.push({
          type: "comment",
          text: comment.trim(),
        });
        this.skip(3);
        return;
      }

      if (tagName.toLowerCase() === docType) {
        const docType = this.skipUntil(() => this.getCurrent() === endTag);
        (this.currentTag as DocumentNode).docType = docType.trim();
        this.skip();
        return;
      }

      this.openTag(tagName);

      if (this.isSelfClosingTag()) {
        this.closeTag(true);
        this.skip(2);
        return;
      }

      if (this.getCurrent() !== endTag) {
        this.parseAttributes();
      }

      if (this.isSelfClosingTag()) {
        this.closeTag(true);
        this.skip(2);
        return;
      }

      if (this.getCurrent() === endTag) {
        if (isSelfClosingTag((this.currentTag as ElementNode).tag)) {
          this.closeTag(true);
        }

        this.skip();
        return;
      }
    }

    if (this.parseTextNode()) {
      return;
    }

    if (this.getCurrent() === "") {
      return;
    }

    this.throwError(new SyntaxError(`Unexpected "${this.getCurrent()}" at ${this.position}`));
  }
}

export function parse(html: string | HTMLElement): DocumentNode {
  return new Parser(typeof html === "string" ? html : html.outerHTML).parse();
}

export function pack(doc: DocumentNode): PackedDocumentNode {
  return ["#", doc.docType, doc.children.map(packNode)];
}

export function unpack(doc: PackedDocumentNode): DocumentNode {
  return { type: "document", docType: doc[1], children: (doc[2] || []).map(unpackNode) };
}

function packNode(node: TextNode | CommentNode | ElementNode): PackedChildNode {
  if (node.type === "comment") {
    return <PackedCommentNode>["!", node.text];
  }

  if (node.type === "text") {
    return <PackedTextNode>node.text;
  }

  return <PackedElementNode>[
    node.tag,
    (node.attributes.length && node.attributes.map((a) => [a.name, a.value])) || [],
    node.children.length ? node.children.map(packNode) : [],
  ];
}

function unpackNode(node: PackedChildNode): ChildNode {
  if (node[0] === "!") {
    return { type: "comment", text: String(node[1]) };
  }

  if (typeof node === "string") {
    return { type: "text", text: node };
  }

  return {
    type: "element",
    tag: node[0],
    selfClose: isSelfClosingTag(node[0]),
    attributes: node[1] ? (node[1] as PackedAttributes).map((a) => ({ name: a[0], value: a[1] })) : [],
    children: node[2] ? (node[2] as PackedChildNode[]).map(unpackNode) : [],
  };
}
