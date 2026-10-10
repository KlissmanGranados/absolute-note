import { describe, expect, it } from 'vitest';
import { htmlToText, sanitizeHtml } from '../src/shared/sanitize.js';

// Parses sanitizer output and returns every element and attribute it contains.
function inspect(html) {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  const elements = Array.from(body.querySelectorAll('*'));
  return {
    tags: elements.map((el) => el.tagName),
    attributes: elements.flatMap((el) => Array.from(el.attributes).map((a) => a.name)),
  };
}

const ALLOWED_OUTPUT_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI']);

describe('sanitizeHtml', () => {
  it.each([
    ['unwrapped anchor', '<a href="javascript:alert(1)"><img src=x onerror=alert(1)></a>'],
    ['svg', '<svg><a><img src=x onerror=alert(1)></a></svg>'],
    ['unstyled span', '<span><img src=x onerror=alert(1)></span>'],
    ['font without attributes', '<font><img src=x onerror=alert(1)></font>'],
    ['nested disallowed tags', '<section><article><img src=x onerror=alert(1)><iframe src=x></iframe></article></section>'],
    ['math', '<math><mtext><img src=x onerror=alert(1)></mtext></math>'],
    ['noscript', '<noscript><img src=x onerror=alert(1)></noscript>'],
    ['allowed tag with handlers', '<b onclick="alert(1)" onmouseover="alert(1)">x</b>'],
    ['details/summary', '<details open ontoggle=alert(1)><summary>x</summary></details>'],
  ])('removes active content: %s', (_, payload) => {
    const out = sanitizeHtml(payload);
    const { tags, attributes } = inspect(out);
    expect(tags.every((t) => ALLOWED_OUTPUT_TAGS.has(t))).toBe(true);
    expect(attributes.every((a) => a === 'style')).toBe(true);
    expect(out).not.toMatch(/<img|<iframe|<svg|<a[\s>]|onerror|onclick|javascript:/i);
  });

  it('drops script and style elements with their content', () => {
    expect(sanitizeHtml('<p>a<script>alert(1)</script><style>p{color:red}</style>b</p>')).toBe('<p>ab</p>');
  });

  it('keeps the allowed formatting', () => {
    expect(sanitizeHtml('<p><b>bold</b> <i>it</i> <u>u</u><br></p><ul><li>one</li></ul>')).toBe(
      '<p><b>bold</b> <i>it</i> <u>u</u><br></p><ul><li>one</li></ul>',
    );
  });

  it('keeps only font-size and color styles', () => {
    const out = sanitizeHtml('<span style="font-size: 18px; color: red; position: fixed; background: url(x)">t</span>');
    const span = new DOMParser().parseFromString(out, 'text/html').body.firstChild;
    expect(span.tagName).toBe('SPAN');
    expect(span.style.fontSize).toBe('18px');
    expect(span.style.color).toBe('red');
    expect(span.style.position).toBe('');
    expect(span.style.background).toBe('');
  });

  it('converts execCommand <font> output into styled spans', () => {
    const out = sanitizeHtml('<font size="7" color="blue">big</font>');
    const span = new DOMParser().parseFromString(out, 'text/html').body.firstChild;
    expect(span.tagName).toBe('SPAN');
    expect(span.style.fontSize).toBe('48px');
    expect(span.style.color).toBe('blue');
    expect(span.textContent).toBe('big');
  });

  it('unwraps spans without styles', () => {
    expect(sanitizeHtml('<span class="x">text</span>')).toBe('text');
  });

  it('escapes legacy plain-text notes', () => {
    expect(sanitizeHtml('a & b > c')).toBe('a &amp; b &gt; c');
  });

  it('returns an empty string for non-strings', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(42)).toBe('');
  });
});

describe('htmlToText', () => {
  it('extracts text without rendering markup', () => {
    expect(htmlToText('<p>Hello <b>world</b></p><img src=x onerror=alert(1)>')).toBe('Hello world');
  });
});
