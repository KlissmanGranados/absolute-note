// The extension's UI lives inside pages it doesn't control. Shadow roots keep the page's CSS away
// from it: page rules can't select elements inside them, and for !important declarations the
// shadow tree's :host rules win over the page's.

export function attachStyledShadow(host, cssText) {
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = cssText;
  root.appendChild(style);
  return root;
}

// Events from inside a shadow root are retargeted to its host; this checks the real path.
export function eventPathMatches(e, selector) {
  return e.composedPath().some((node) => node instanceof Element && node.matches(selector));
}

// Inline !important beats any stylesheet rule, including the page's !important ones.
export function setImportant(el, property, value) {
  if (value === '' || value == null) el.style.removeProperty(property);
  else el.style.setProperty(property, value, 'important');
}
