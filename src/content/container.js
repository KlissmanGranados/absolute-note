// Notes are positioned inside the page's scroll container so they scroll with its content.
// Coordinates are relative to that container: posX_px is the note's horizontal center
// (the stylesheet applies translate(-50%, 0)) and posY_px its top edge.

const OWN_UI_SELECTOR = '.absolute-note, .absolute-note-host';
const DIALOG_SELECTOR = 'dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]';
const OVERLAY_HINT = /modal|popup|overlay|dialog|cookie|consent|paywall|backdrop|lightbox/i;
const OVERLAY_MIN_Z_INDEX = 1000;

// Modals, cookie/paywall layers and other fixed overlays scroll on their own but aren't page
// content: notes placed in them would take their styles and disappear when they close.
function isOverlay(el) {
  if (el.matches(DIALOG_SELECTOR)) return true;
  const s = window.getComputedStyle(el);
  if (s.position !== 'fixed') return false;
  const z = parseInt(s.zIndex, 10);
  return z >= OVERLAY_MIN_Z_INDEX || OVERLAY_HINT.test((el.id || '') + ' ' + (el.getAttribute('class') || ''));
}

function isInsideOverlay(el) {
  for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (isOverlay(el)) return true;
  }
  return false;
}

export function isDefaultContainer(el) {
  return !el || el === document.documentElement || el === document.body;
}

function isScrollableStyle(s) {
  return (
    s.overflowY === 'auto' || s.overflowY === 'scroll' || s.overflowY === 'overlay' ||
    s.overflow === 'auto' || s.overflow === 'scroll' || s.overflow === 'overlay'
  );
}

// Walks up from `el` and picks the scrollable ancestor with the most scrollable surface.
export function findScrollContainer(el) {
  if (el && isInsideOverlay(el)) el = document.body;
  let candidate = null;
  let best = null;
  let bestSurface = -1;
  while (el) {
    if (isScrollableStyle(window.getComputedStyle(el))) {
      const surface = (el.scrollHeight - el.clientHeight) + (el.scrollWidth - el.clientWidth);
      if (!candidate) candidate = el;
      if (best === null || surface > bestSurface) {
        best = el;
        bestSurface = surface;
      }
    }
    if (el === document.documentElement) break;
    el = el.parentElement;
  }
  if (best && bestSurface > 0) return best;
  if (candidate) return candidate;
  return document.scrollingElement || document.documentElement;
}

// The topmost page element at a viewport point, ignoring the extension's own UI and overlays.
export function pageElementAt(x, y) {
  return document.elementsFromPoint(x, y).find((el) => !el.closest(OWN_UI_SELECTOR) && !isInsideOverlay(el)) || null;
}

// Viewport position of the container's (0, 0), measured from a note placed in it. Being empirical,
// it accounts for scrolling, borders and positioned ancestors of any container.
export function originOf(noteEl) {
  const r = noteEl.getBoundingClientRect();
  return {
    x: r.left + r.width / 2 - (parseFloat(noteEl.style.left) || 0),
    y: r.top - (parseFloat(noteEl.style.top) || 0),
  };
}

// Absolutely positioned notes need a positioned container to scroll with it. Only containers that
// are statically positioned are touched, and their inline value is restored on release.
const claimed = new WeakMap();

export function claimContainer(c) {
  if (isDefaultContainer(c) || claimed.has(c)) return;
  if (window.getComputedStyle(c).position !== 'static') return;
  claimed.set(c, c.style.position);
  c.style.position = 'relative';
}

export function releaseContainer(c) {
  if (!c || !claimed.has(c)) return;
  c.style.position = claimed.get(c);
  claimed.delete(c);
}
