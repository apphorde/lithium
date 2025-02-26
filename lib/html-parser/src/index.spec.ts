import { describe, it } from 'node:test';
import assert from 'assert';
import { ElementNode, parse, pack, unpack } from './index';

function expect(actual) {
  return {
    toBe(expected) {
      assert.strictEqual(actual, expected);
    },

    toEqual(expected) {
      assert.deepEqual(actual, expected);
    },

    toThrowError(expected) {
      assert.throws(actual, new SyntaxError(expected), 'throws error');
    },
  };
}

describe('html parser', () => {
  it('should autoclose void elements', () => {
    expect(parse(`<link><meta><br><hr>`)).toEqual({
      type: 'document',
      docType: 'html',
      children: [
        {
          type: 'element',
          tag: 'link',
          selfClose: true,
          children: [],
          attributes: [],
        },
        {
          type: 'element',
          tag: 'meta',
          selfClose: true,
          children: [],
          attributes: [],
        },
        {
          type: 'element',
          tag: 'br',
          selfClose: true,
          children: [],
          attributes: [],
        },
        {
          type: 'element',
          tag: 'hr',
          selfClose: true,
          children: [],
          attributes: [],
        },
      ],
    });
  });

  it('should ignore spaces in closing tags', () => {
    expect(parse(`<a>test</a  >`)).toEqual({
      type: 'document',
      docType: 'html',
      children: [
        {
          type: 'element',
          tag: 'a',
          selfClose: false,
          children: [{ type: 'text', text: 'test' }],
          attributes: [],
        },
      ],
    });
  });

  it('should autoclose an input with attributes', () => {
    expect(parse(`<input type="text"/>`)).toEqual({
      type: 'document',
      docType: 'html',
      children: [
        {
          type: 'element',
          tag: 'input',
          selfClose: true,
          children: [],
          attributes: [{ name: 'type', value: 'text' }],
        },
      ],
    });
  });

  it('should parse attributes with invalid characters or no value', () => {
    expect(parse(`<input [type]="text" disabled/>`)).toEqual({
      type: 'document',
      docType: 'html',
      children: [
        {
          type: 'element',
          tag: 'input',
          selfClose: true,
          children: [],
          attributes: [
            { name: '[type]', value: 'text' },
            { name: 'disabled', value: '' },
          ],
        },
      ],
    });
  });

  it('should allow escaped double quotes in attribute values', () => {
    expect(parse(`<input name="tes\\"t" value="1"/>`)).toEqual({
      type: 'document',
      docType: 'html',
      children: [
        {
          type: 'element',
          tag: 'input',
          selfClose: true,
          children: [],
          attributes: [
            {
              name: 'name',
              value: 'tes\\"t',
            },
            {
              name: 'value',
              value: '1',
            },
          ],
        },
      ],
    });
  });

  it('should ignore spaces', () => {
    const inputs = [
      `<input       />`,
      `<input
      />`,
      `<input

      />`,
    ];

    inputs.forEach((input) =>
      expect(parse(input)).toEqual({
        type: 'document',
        docType: 'html',
        children: [
          {
            type: 'element',
            tag: 'input',
            selfClose: true,
            children: [],
            attributes: [],
          },
        ],
      }),
    );
  });

  it('should throw error if a tag was not closed', () => {
    expect(() => parse(`<div>`)).toThrowError('Some tags are not closed: div');
  });

  it('should throw an error on invalid attribute name or value', () => {
    expect(() => parse(`<div /s ></div>`)).toThrowError('Unexpected "/". Expected attribute name at 1:6');
    expect(() => parse(`<div class=</div>`)).toThrowError('Unexpected "<". Expected " at 1:12');
    expect(() => parse(`<div//>`)).toThrowError('Unexpected "/". Expected attribute name at 1:5');
  });

  it('should throw an error when closing the wrong tag', () => {
    expect(() => parse(`<div></span>`)).toThrowError('Expected closing "div", found "span"');
  });

  it('should parse comments and text', () => {
    expect(parse(`<!-- comment      -->`)).toEqual({
      type: 'document',
      docType: 'html',
      children: [{ type: 'comment', text: 'comment' }],
    });

    expect(parse(`text only`)).toEqual({
      type: 'document',
      docType: 'html',
      children: [{ type: 'text', text: 'text only' }],
    });
  });

  it('should parse a script tag with html inside', () => {
    const html = `<!doctype html><script>const html = '<div/>';</script><div></div>`;
    const doc = parse(html);
    expect(doc).toEqual({
      type: 'document',
      docType: 'html',
      children: [
        {
          attributes: [],
          children: [{ type: 'text', text: `const html = '<div/>';` }],
          selfClose: false,
          tag: 'script',
          type: 'element',
        },
        {
          attributes: [],
          children: [],
          selfClose: false,
          tag: 'div',
          type: 'element',
        },
      ],
    });
  });

  it('should parse an HTML document', () => {
    const html = `<!doctype html><html lang="en">
      <head>
        <link>
        <meta>
      </head>
      <body>
        <p>Text<br></p>
        <div class="something">
          <input/>
          <hr />
          <input type="text" [disabled]="false" />
          <!-- comment -->
          <hr>
        </div>
      </body>
    </html>
    `;

    const doc = parse(html);
    const firstNode = doc.children[0] as ElementNode;

    expect(doc.type).toBe('document');
    expect(doc.docType).toBe('html');

    expect(firstNode.type).toBe('element');
    expect(firstNode.tag).toBe('html');
    expect(firstNode.selfClose).toBe(false);
    expect(firstNode.attributes).toEqual([{ name: 'lang', value: 'en' }]);
  });
});

describe('pack and unpack nodes', () => {
  it('should pack nodes', () => {
    expect(pack(parse(`<!doctype html>`))).toEqual(['#', 'html', []]);
    expect(pack(parse(`<div></div>`))).toEqual(['#', 'html', [['div', [], []]]]);
    expect(pack(parse(`<input type="text">`))).toEqual(['#', 'html', [['input', [['type', 'text']], []]]]);
    expect(pack(parse(`<!-- a comment -->`))).toEqual(['#', 'html', [['!', 'a comment']]]);
    expect(pack(parse(`text content`))).toEqual(['#', 'html', ['text content']]);
  });

  it('should unpack nodes', () => {
    expect(unpack(['#', 'html', []])).toEqual(parse(`<!doctype html>`));
    expect(unpack(['#', 'html', [['div', [['class', 'foo']]]]])).toEqual(parse(`<div class="foo"></div>`));
    expect(unpack(['#', 'html', [['input', [['type', 'text']]]]])).toEqual(parse(`<input type="text">`));
    expect(unpack(['#', 'html', [['!', 'a comment']]])).toEqual(parse(`<!-- a comment -->`));
    expect(unpack(['#', 'html', ['text content']])).toEqual(parse(`text content`));
  });

  it('should parse attributes without a value', () => {
    const doc = parse(`<input checked readonly /><script nomodule></script>`);
    expect(doc).toEqual({
      type: 'document',
      docType: 'html',
      children: [
        {
          type: 'element',
          tag: 'input',
          selfClose: true,
          attributes: [
            {
              name: 'checked',
              value: '',
            },
            {
              name: 'readonly',
              value: '',
            },
          ],
          children: [],
        },
        {
          type: 'element',
          tag: 'script',
          selfClose: false,
          attributes: [
            {
              name: 'nomodule',
              value: '',
            },
          ],
          children: [],
        },
      ],
    });
  });
});
