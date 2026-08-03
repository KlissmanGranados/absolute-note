var ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'FONT', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI']);
var FONT_SIZES = { '1': '10px', '2': '13px', '3': '16px', '4': '18px', '5': '24px', '6': '32px', '7': '48px' };

function sanitizeHtml(input) {
  if (typeof input !== 'string' || !input) return '';
  if (input.indexOf('<') === -1) {
    var plain = document.createElement('div');
    plain.textContent = input;
    return plain.innerHTML;
  }
  var doc = new DOMParser().parseFromString(input, 'text/html');
  var root = doc.body;

  function sanitize(parent) {
    Array.from(parent.children).forEach(function (el) {
      var tag = el.tagName.toUpperCase();
      if (!ALLOWED_TAGS.has(tag)) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        return;
      }
      var style = {};
      if (el.style && el.style.fontSize) style.fontSize = el.style.fontSize;
      if (el.style && el.style.color) style.color = el.style.color;
      var fontColor = el.getAttribute ? el.getAttribute('color') : null;
      var fontSize = el.getAttribute ? el.getAttribute('size') : null;
      Array.from(el.attributes).forEach(function (a) { el.removeAttribute(a.name); });
      for (var k in style) el.style[k] = style[k];

      if (tag === 'FONT') {
        if (fontSize && FONT_SIZES[fontSize]) {
          var span = doc.createElement('span');
          span.style.fontSize = FONT_SIZES[fontSize];
          if (fontColor) span.style.color = fontColor;
          while (el.firstChild) span.appendChild(el.firstChild);
          el.parentNode.replaceChild(span, el);
          sanitize(span);
          return;
        }
        if (!fontColor) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
          return;
        }
        el.setAttribute('color', fontColor);
      }
      if (tag === 'SPAN' && !el.getAttribute('style')) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        return;
      }
      sanitize(el);
    });
  }

  sanitize(root);
  return root.innerHTML;
}

function sanitizeNote(note) {
  var n = Object.assign({}, note);
  if (typeof n.text === 'string') n.text = sanitizeHtml(n.text);
  return n;
}
