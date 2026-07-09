# HTML Parser Bug Analysis Plan

This is a work-in-progress plan to address bugs and pitfalls found in `lib/html-parser/src/parse.ts`.

---

## High Priority Fixes

### 1. Fix escaped quote handling in attribute values (Bug #1)

**Problem**: The parser treats `\"` inside quoted attributes as an escaped quote that doesn't end the attribute. But HTML does not support escaping quotes inside quoted attributes — a `"` always ends the value.

**Current code** (~line 198):

```ts
if (this.getCurrent() === doubleQuote && this.getPrevious() !== backSlash) {
```

**Fix**: Remove the backslash check. A double-quote always terminates an attribute value:

```ts
if (this.getCurrent() === doubleQuote) {
```

**Impact**: Consumers currently get incorrect values like `tes\"t` instead of `tes\`. This is silently wrong and hard to debug downstream.

---

### 2. Fix DOCTYPE parsing for complex DOCTYPEs (Bug #6)

**Problem**: The parser captures everything up to the first `>`, which breaks on DOCTYPEs containing URLs:

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
```

This would stop at the first `>` inside the URL, producing garbage.

**Fix**: Implement proper DOCTYPE parsing that respects quoted strings and only terminates on an unquoted `>`:

- Track quote state (inside/outside quotes)
- Only terminate when `>` is outside of quotes
- Or use a simpler regex-based extraction

---

### 3. Add HTML entity decoding (Bug #14)

**Problem**: Text content passes through verbatim. `<div>&amp;</div>` produces `{ text: "&amp;" }` instead of `{ text: "&" }`.

**Options**:

- A. Add a `decodeEntities` option to the Parser constructor (opt-in)
- B. Always decode common entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, numeric entities)
- C. Document that consumers must handle entity decoding separately

**Recommendation**: Option B with a configurable flag, since a "parser" is expected to resolve entities.

---

## Medium Priority Fixes

### 4. Fix comment text data loss (Bug #3)

**Problem**: `comment.trim()` strips leading/trailing whitespace from the comment body, losing literal content.

**Fix**: Either remove `.trim()` or document that comments are normalized. Consider preserving original text and adding a separate `normalizedText` accessor if normalization is useful.

---

### 5. Improve mismatched closing tag error messages (Bug #4)

**Problem**: `<div><span></div></span>` produces "Expected closing 'span', found 'div'" — the real problem is that `</div>` was in the wrong place, not that the tags don't match per se.

**Fix**: Search the stack for the expected tag and produce a better message:

```
"Unexpected '</div>' at 1:13. Did you mean to close '<div>' first?"
```

---

### 6. Distinguish boolean vs empty-string attributes (Bug #10)

**Problem**: `<input disabled>` and `<input disabled="">` both produce `{ name: "disabled", value: "" }`. In HTML DOM, the difference matters for boolean attribute semantics.

**Fix**: Use a sentinel or special marker for implicit boolean attributes:

```ts
// BooleanAttribute is a new type with value = undefined or Symbol("boolean")
{ name: "disabled", value: undefined }  // implicit boolean
{ name: "disabled", value: "" }          // explicit empty string
```

---

### 7. Handle HTMLElement input safely (Bug #2)

**Problem**: Passing an `HTMLElement` calls `outerHTML`, which is non-deterministic across environments. Attribute order, casing, and quoting vary by implementation.

**Fix**: Either:

- A. Document the limitation and recommend always passing strings
- B. Reject HTMLElement inputs with a clear error
- C. Normalize the input in a controlled way (e.g., serialize attributes in sorted order)

---

## Low Priority / Design Considerations

### 8. Default docType when none exists (Bug #5)

**Problem**: Missing `<!doctype>` still produces `docType: "html"` instead of `undefined`.

**Fix**: Initialize with `docType: undefined` or `"unknown"` and set it only when a doctype tag is found.

---

### 9. Boolean attributes without values handled silently (Bug #8)

**Problem**: `<div class = >` parses an attribute named `class` with empty value — no warning about the missing value. The parser is very forgiving.

**Assessment**: This is arguably fine for a "forgiving" parser. Document this behavior.

---

### 10. Script content edge cases (Bug #9)

**Problem**: Obfuscated JS containing `</scr<script>ipt>` could prematurely terminate script parsing. The look-ahead check for `</script` is simplistic.

**Fix**: Use a more robust check that verifies the full `</script` sequence followed by whitespace or `>`. This is an edge case and low risk.

---

### 11. normalize() mutation semantics (Bug #11)

**Problem**: `normalize()` mutates in place AND returns the node — dual behavior is confusing.

**Fix**: Either make it purely functional (return a new tree) or clearly document it as an in-place mutator. Consider renaming to `normalizeInPlace()` if keeping mutation.

---

### 12. Error reporting performance (Bug #12)

**Problem**: `this.html.split("\n")[line - 1]` splits the entire file on every error. For large files this is wasteful.

**Fix**: Track line content incrementally during parsing, or cache line beginnings:

```ts
// Cache line start indices once
const lineStarts: number[] = [];
for (let i = 0; i < html.length; i++) {
  if (i === 0 || html[i - 1] === '\n') lineStarts.push(i);
}
const source = html.substring(lineStarts[line - 1], lineStarts[line] ?? html.length);
```

---

### 13. Infinite loop detection gap (Bug #13)

**Problem**: Only catches adjacent-iteration stalls (0 chars advanced). Cycles that advance >0 chars each iteration aren't caught until OOM.

**Assessment**: Very low risk for normal input. Add a max-depth guard if concerned.

---

## Not Bugs (Intentional Design)

- **No whitespace normalization in text nodes**: The parser preserves raw text including indentation. This is by design for fidelity.
- **No attribute validation**: The parser accepts any attribute name like `[type]`, `v-on:click`. This is intentional — it's a generic HTML parser, not an HTML validator.

---

## Proposed Execution Order

1. **Bug #1** — Fix escaped quotes (high impact, simple fix)
2. **Bug #6** — Fix DOCTYPE parsing (high impact, moderate complexity)
3. **Bug #14** — Add entity decoding (high impact, adds new functionality)
4. **Bug #3** — Fix comment trimming (medium impact, simple fix)
5. **Bug #4** — Improve error messages (UX improvement)
6. **Bug #5** — Fix default docType (simple fix)
7. **Bug #10** — Distinguish boolean attributes (moderate complexity)
8. Documentation updates for known limitations (#2, #8, #9, #13)
