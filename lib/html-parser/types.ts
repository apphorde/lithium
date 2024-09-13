export interface ParserAttribute {
  name: string;
  value: string;
}

export interface DocumentNode {
  type: 'document';
  docType: string;
  children: Children;
}

export interface ElementNode {
  type: 'element';
  tag: string;
  selfClose: boolean;
  children: Children;
  attributes: Array<ParserAttribute>;
}

export interface CommentNode {
  type: 'comment';
  text: string;
}

export interface TextNode {
  type: 'text';
  text: string;
}

export type ChildNode = ElementNode | CommentNode | TextNode;
export type Children = Array<ChildNode>;
export type ParserNode = DocumentNode | ChildNode;

export type PackedAttributes = Array<[string, string]>;
export type PackedChildren = Array<PackedChildNode>;
export type PackedChildNode = PackedElementNode | PackedCommentNode | PackedTextNode;
export type PackedTextNode = string;
export type PackedCommentNode = ['!', string];
export type PackedElementNode = [string] | [string, PackedAttributes] | [string, PackedAttributes, PackedChildren];
export type PackedDocumentNode = ['#', string] | ['#', string, PackedChildren];

export type PackedParserNode = PackedDocumentNode | PackedChildNode;