import { COLORS } from '../shared/constants.js';
import { getText } from '../shared/i18n.js';
import { sanitizedNodes } from '../shared/sanitize.js';
import headerCss from './css/note-header.css';
import gripCss from './css/resize-grip.css';
import { attachStyledShadow, eventPathMatches, setImportant } from './shadow.js';

// Events that must not reach the page's own handlers (drag libraries, "click outside" handlers,
// keyboard shortcuts while typing, …).
const ISOLATED_EVENTS = ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick', 'keydown', 'keyup', 'keypress'];

const px = (n) => (n != null ? n + 'px' : '');

// DOM for a single note. It renders whatever note object it is given and reports user intent
// through callbacks; it never touches storage.
//
// The note element and its editable body are regular DOM (hardened by styles.css); the header
// controls and the resize grip are in shadow roots so page CSS can't restyle them.
export class NoteView {
  constructor(note, { onColor, onDelete, onEditRequest, onPointerDown, onResizeStart }) {
    this.id = note.id;
    this.renderedText = null;

    const el = document.createElement('div');
    el.className = 'absolute-note';
    el.id = 'absolute-note-' + note.id;
    el.dataset.noteId = note.id;

    this.header = document.createElement('div');
    this.header.className = 'absolute-note-header';
    const headerRoot = attachStyledShadow(this.header, headerCss);

    this.colorsWrap = document.createElement('div');
    this.colorsWrap.className = 'colors';
    COLORS.forEach((c, i) => {
      const dot = document.createElement('span');
      dot.className = 'absolute-note-color-dot';
      dot.style.background = c.bg;
      dot.style.borderColor = c.border;
      dot.addEventListener('click', () => onColor(i));
      this.colorsWrap.appendChild(dot);
    });

    this.deleteBtn = document.createElement('button');
    this.deleteBtn.type = 'button';
    this.deleteBtn.className = 'absolute-note-delete';
    this.deleteBtn.textContent = '×';
    this.deleteBtn.addEventListener('click', onDelete);
    headerRoot.append(this.colorsWrap, this.deleteBtn);

    this.body = document.createElement('div');
    this.body.className = 'absolute-note-body';
    this.body.contentEditable = 'false';

    this.grip = document.createElement('div');
    this.grip.className = 'absolute-note-resize';
    attachStyledShadow(this.grip, gripCss);
    this.grip.addEventListener('pointerdown', onResizeStart);

    el.append(this.header, this.body, this.grip);

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('dblclick', (e) => {
      if (eventPathMatches(e, 'button, .absolute-note-color-dot, .absolute-note-resize, select, input, a')) return;
      onEditRequest();
    });
    const stop = (e) => e.stopPropagation();
    ISOLATED_EVENTS.forEach((type) => el.addEventListener(type, stop));

    this.el = el;
    this.applyLang();
    this.update(note);
  }

  update(note, { keepText = false } = {}) {
    const c = COLORS[note.colorIndex] || COLORS[0];
    setImportant(this.el, 'background', c.bg);
    this.header.style.setProperty('--absolute-note-header-bg', c.header);
    this.el.dataset.colorIndex = String(note.colorIndex);
    Array.from(this.colorsWrap.children).forEach((dot, i) => dot.classList.toggle('active', i === note.colorIndex));

    this.setPosition(note.posX_px, note.posY_px);
    this.setSize(note.w_px, note.h_px);
    setImportant(this.el, 'font-size', note.fontSize ? px(note.fontSize) : '');
    this.el.classList.toggle('absolute-note--locked', note.locked);

    if (!keepText && note.text !== this.renderedText) {
      this.body.replaceChildren(...sanitizedNodes(note.text));
      this.renderedText = note.text;
    }
  }

  setPosition(x, y) {
    setImportant(this.el, 'left', px(x));
    setImportant(this.el, 'top', px(y));
  }

  // Width and minimum height; the note still grows with its text.
  setSize(width, minHeight) {
    setImportant(this.el, 'width', px(width));
    setImportant(this.el, 'min-height', px(minHeight));
  }

  setDragging(on) {
    this.el.classList.toggle('absolute-note-dragging', on);
    this.header.classList.toggle('dragging', on);
  }

  // Marks text produced by the editor as already rendered, so the next update doesn't replace the DOM.
  markTextRendered(text) {
    this.renderedText = text;
  }

  highlight() {
    this.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setImportant(this.el, 'box-shadow', '0 0 0 3px #1565c0, 2px 4px 12px rgba(0,0,0,0.25)');
    clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => setImportant(this.el, 'box-shadow', ''), 2000);
  }

  applyLang() {
    this.deleteBtn.title = getText('delete');
    this.body.dataset.placeholder = getText('outline_empty');
  }

  destroy() {
    clearTimeout(this.highlightTimer);
    this.el.remove();
  }
}
