const HTML_NS = 'http://www.w3.org/1999/xhtml';
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI']);
// Removed together with their content; everything else outside the allowlist is unwrapped.
const DROPPED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'IFRAME', 'FRAME', 'FRAMESET', 'OBJECT', 'EMBED',
  'SVG', 'MATH', 'HEAD', 'TITLE', 'META', 'LINK', 'BASE',
]);
const FONT_SIZES = { 1: '10px', 2: '13px', 3: '16px', 4: '18px', 5: '24px', 6: '32px', 7: '48px' };

function escapeText(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function unwrap(el) {
  el.replaceWith(...el.childNodes);
}

function cleanChildren(parent) {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === ELEMENT_NODE) cleanElement(child);
    else if (child.nodeType !== TEXT_NODE) child.remove();
  }
}

// Children are cleaned before their parent is unwrapped or replaced, so nothing hoisted out of a
// disallowed element can skip sanitization.
function cleanElement(el) {
  const tag = el.tagName.toUpperCase();
  if (DROPPED_TAGS.has(tag)) {
    el.remove();
    return;
  }
  cleanChildren(el);
  if (el.namespaceURI !== HTML_NS) {
    unwrap(el);
    return;
  }
  if (tag === 'FONT') {
    replaceFont(el);
    return;
  }
  if (!ALLOWED_TAGS.has(tag)) {
    unwrap(el);
    return;
  }
  // Only these two declarations survive; the CSSOM has already rejected invalid values.
  const { fontSize, color } = el.style;
  for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
  if (fontSize) el.style.fontSize = fontSize;
  if (color) el.style.color = color;
  if (tag === 'SPAN' && !el.hasAttribute('style')) unwrap(el);
}

// execCommand('fontSize') emits <font size="1-7">; it is stored as a styled <span> instead.
function replaceFont(el) {
  const span = el.ownerDocument.createElement('span');
  const fontSize = FONT_SIZES[el.getAttribute('size')] || el.style.fontSize;
  const color = el.getAttribute('color') || el.style.color;
  if (fontSize) span.style.fontSize = fontSize;
  if (color) span.style.color = color;
  span.append(...el.childNodes);
  el.replaceWith(span);
  if (!span.hasAttribute('style')) unwrap(span);
}

export function sanitizeHtml(input) {
  if (typeof input !== 'string' || !input) return '';
  // Legacy plain-text notes.
  if (!input.includes('<')) return escapeText(input);
  const body = new DOMParser().parseFromString(input, 'text/html').body;
  cleanChildren(body);
  return body.innerHTML;
}

// Sanitized content as DOM nodes, ready to be inserted without going through innerHTML.
export function sanitizedNodes(input) {
  const html = sanitizeHtml(input);
  return html ? Array.from(new DOMParser().parseFromString(html, 'text/html').body.childNodes) : [];
}
