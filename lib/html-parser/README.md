# @li3/html-parser

Simple html parser for quick document scanning and transformations.
The parser expects a well formed HTML source, without quirks or any special rules.

## Syntax expectations

- Only `<!doctype html>` accepted
- all attributes must have a value, even if empty. e.g. `disabled=""`
- all tags are opened and closed correctly

## Known limitations

### Critical / Logic Bugs

**1. Escaped quotes in attribute values are mishandled**
The test in index.spec.ts shows `<input name="tes\\"t" value="1"/>` producing `value: 'tes\\"t'` — the backslash is kept in the output. But in real HTML, `\"` inside a quoted attribute does not escape the quote; it's just a literal backslash followed by a quote that *ends* the attribute. The parser's `getPrevious() !== backSlash` check treats this as an escaped quote, producing wrong results:

```ts
// Line ~198 — BUG: HTML doesn't support escaping inside quoted attributes
if (this.getCurrent() === doubleQuote && this.getPrevious() !== backSlash) {
```

**2. `parse()` accepts `HTMLElement` but silently produces wrong output**
```ts
export function parse(html: string | HTMLElement): DocumentNode {
  return new Parser(typeof html === "string" ? html : html.outerHTML).parse();
}
```
If you pass an `HTMLElement`, it calls `outerHTML` — which normalizes/serializes the DOM. This means parsing behavior is *non-deterministic* based on browser/Node-DOM-implementation serialization. Two elements that look identical in source can produce different Parsed output depending on how their serializer writes attributes (e.g., order, casing, quoting).

**3. Comment text is trimmed after being captured — data loss**
```ts
const comment = this.skipUntil(() => endComment === this.lookAhead(3));
this.currentTag.children.push({
  type: "comment",
  text: comment.trim(),  // BUG: trims leading/trailing whitespace from comment body
});
```
HTML comments `<!-- a  b -->` should preserve internal spacing. The `.trim()` loses the exact text content, which matters for any use-case relying on literal comment contents (e.g., templating engines).

**4. Nested mismatched closing tags produce cascading/wrong errors**
The parser checks `if ((this.currentTag as ElementNode).tag !== tagToClose)` only against the *top of stack*. If a user writes `<div><span></div></span>`, it errors with "Expected closing 'span', found 'div'" — but the real problem is that `</div>` closed the wrong tag. A smarter parser would search the stack and give a better error or auto-correct like browsers do. Currently it just crashes with an unhelpful message.

**5. `docType` is always set to `"html"` by default even when absent**
```ts
root: DocumentNode = { type: "document", docType: "html", children: [] };
```
If no `<!doctype>` exists in the source, the root document still reports `docType: "html"`. The correct behavior is `undefined` or some sentinel for "no doctype found."

### Parsing / Edge Case Pitfalls

**6. DOCTYPE is captured incorrectly — includes trailing characters**
```ts
const docType = this.skipUntil(() => this.getCurrent() === endTag);
(this.currentTag as DocumentNode).docType = docType.trim();
```
`skipUntil` stops *before* the matching condition. So for `<!doctype html>`, it captures `doctype html` (the `>` is the terminator, not included). But DOCTYPEs can be complex: `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">`. This parser would only capture up to the first `>` inside the public URL, producing garbage.

**7. Void/self-closing elements have their `selfClose` flag checked AFTER the tag is already opened**
```ts
// In parseNext():
this.openTag(tagName);
// ...parse attributes...
if (isSelfClosingTag((this.currentTag as ElementNode).tag)) {
  this.closeTag(true);
}
```
For `<div><br></div>`, the `<br>` is pushed onto the stack, then immediately popped. This works but is a subtle ordering issue — if someone reads `currentTag` between `openTag` and that check, they'd see a partially-opened tag on the stack.

**8. Attributes with special characters are accepted silently**
The attribute name parser accepts anything that isn't whitespace/equals/slash/greater-than: `[type]`, `v-on:click`, `data-x@y`. While this is "forgiving," it means non-standard HTML attribute syntax is silently accepted without any validation. This might be intentional but is worth noting — `<div class = >` would parse an attribute named `class` with value `` (empty, because the `>` ends parsing before `parseAttributeValue` runs).

**9. `skipUntil` for script content breaks on nested `</script` patterns**
```ts
const condition = !isScript
  ? () => this.getCurrent() === startTag
  : () => this.getCurrent() === startTag && this.lookAhead(closeScriptTag.length) === closeScriptTag;
```
If the script contains `< /script` (with a space) — which should *not* end the script tag — it's handled correctly. But if the script contains `</scr<script>ipt>` or similar obfuscated patterns, the look-ahead check could prematurely terminate script parsing. This is an edge case but real-world minified JS can contain tricky sequences.

**10. Boolean attributes without values have no standard HTML treatment**
```ts
if (this.getCurrent() === equals) {
  this.skip();
  value = this.parseAttributeValue();
}
// If no '=', value stays '' — always
```
In HTML, `<input disabled>` is equivalent to `<input disabled="">` which in DOM is `element.disabled === true`. The parser stores it as `{ name: "disabled", value: "" }` — consumers need to know to treat empty-string values for boolean attributes specially. There's no built-in distinction between `disabled=""` (explicit) and `disabled` (implicit boolean).

**11. `normalize()` mutates in place but also returns the node — inconsistent with functional patterns**
```ts
export function normalize<T extends ParserNode>(node: T) {
  if ("children" in node) {
    node.children = node.children.filter(...)  // MUTATES
  }
  return node;  // But also returns
}
```
This dual behavior (side-effect + return value) can confuse consumers. If you call `normalize(doc)` and then use the original reference, it works — but if someone writes `const x = normalize(y); console.log(y.children)` expecting the old value, it's already mutated.

### Performance / Robustness Issues

**12. `html.split("\n")` on every error is expensive for large documents**
```ts
const source = this.html.split("\n")[line - 1];
```
For a 1MB HTML file with an error on line 50, this splits all 50K+ lines just to get one. A better approach would track line content incrementally or use `indexOf` from the last known position.

**13. Infinite loop detection only catches adjacent-iteration stalls**
```ts
if (last === this.index) {
  this.throwError(new Error(`Infinite loop at ${this.position}`));
}
```
If a parser function advances by exactly 0 chars across iterations, it's caught. But a function that advances by >0 chars in a cycle (e.g., parsing attributes in a malformed state that somehow always produces new chars) wouldn't be detected until memory is exhausted.

**14. No handling of HTML entities (`&amp;`, `&#x27;`, etc.)**
Text content passes through verbatim. So `<div>&amp;</div>` produces `{ text: "&amp;" }` not `{ text: "&" }`. Consumers need to handle entity decoding separately, which is a common gotcha for a "parsing" library.

### Summary Table

| # | Severity | Issue |
|---|----------|-------|
| 1 | **High** | Escaped quote handling wrong (HTML doesn't escape in attributes) |
| 2 | Medium | `HTMLElement` input produces non-deterministic results |
| 3 | Medium | Comment `.trim()` loses data |
| 4 | Medium | Mismatched tags give confusing error messages |
| 5 | Low | Default `docType: "html"` when none exists |
| 6 | **High** | DOCTYPE parsing breaks on complex DOCTYPEs with URLs |
| 7 | Low | Subtle ordering in void element handling |
| 8 | Info | No attribute name validation (forgiving but unexpected) |
| 9 | Low | Script content can break on obfuscated `</script` patterns |
| 10 | Medium | Boolean vs empty-string attributes not distinguished |
| 11 | Info | `normalize()` has confusing mutation semantics |
| 12 | Low | Expensive split() on error for large files |
| 13 | Low | Limited infinite loop detection |
| 14 | **High** | HTML entities not decoded — consumers get raw `&amp;` etc. |

