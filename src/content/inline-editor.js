import { FONT_SIZE_RANGE } from '../shared/constants.js';
import { getText } from '../shared/i18n.js';
import { sanitizeHtml } from '../shared/sanitize.js';
import toolbarCss from './css/inline-toolbar.css';
import { attachStyledShadow } from './shadow.js';

const SIZE_OPTIONS = [12, 14, 16, 18, 24, 32];

// Rich-text editing inside a note body (contentEditable + a small toolbar). One note at a time.
export class InlineEditor {
  constructor({ onCommit }) {
    this.onCommit = onCommit;
    this.view = null;
    this.savedRange = null;
    this.toolbar = null;
    this.onFocusOut = this.onFocusOut.bind(this);
  }

  get editingId() {
    return this.view ? this.view.id : null;
  }

  start(view, note) {
    if (this.view === view) return;
    if (this.view) this.finish();
    this.view = view;
    this.savedRange = null;
    const body = view.body;
    body.contentEditable = 'true';
    body.classList.add('absolute-note-body--editing');
    view.el.addEventListener('focusout', this.onFocusOut);
    this.toolbar = this.buildToolbar(note);
    view.el.appendChild(this.toolbar);
    requestAnimationFrame(() => {
      if (this.view !== view) return;
      body.focus();
      const range = document.createRange();
      range.selectNodeContents(body);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
  }

  // Ends editing and hands the sanitized content to onCommit (unless `commit` is false).
  finish({ commit = true } = {}) {
    const view = this.view;
    if (!view) return;
    this.view = null;
    view.el.removeEventListener('focusout', this.onFocusOut);
    view.body.contentEditable = 'false';
    view.body.classList.remove('absolute-note-body--editing');
    if (this.toolbar) this.toolbar.remove();
    this.toolbar = null;
    if (commit) this.onCommit(view.id, sanitizeHtml(view.body.innerHTML));
  }

  onFocusOut(e) {
    const view = this.view;
    if (view && e.relatedTarget instanceof Element && view.el.contains(e.relatedTarget)) {
      // Focus moved to the toolbar (e.g. the size select): remember the selection to restore it.
      const sel = window.getSelection();
      if (sel.rangeCount > 0) this.savedRange = sel.getRangeAt(0).cloneRange();
      return;
    }
    this.finish();
  }

  // The toolbar's controls live in a shadow root, out of reach of the page's button/select styles.
  buildToolbar(note) {
    const bar = document.createElement('div');
    bar.className = 'absolute-note-inline-toolbar';
    const root = attachStyledShadow(bar, toolbarCss);
    root.append(
      this.commandButton('B', 'bold', getText('bold')),
      this.commandButton('I', 'italic', getText('italic')),
      this.commandButton('U', 'underline', getText('underline')),
      this.sizeSelect(note.fontSize || 14),
    );

    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'absolute-note-inline-done';
    done.textContent = '✓';
    done.title = getText('save');
    done.addEventListener('mousedown', (e) => e.preventDefault());
    done.addEventListener('click', () => this.finish());
    root.appendChild(done);
    return bar;
  }

  commandButton(label, command, title) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'absolute-note-inline-btn';
    b.textContent = label;
    b.title = title;
    // Keep focus (and the selection) in the note body.
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => {
      if (!this.view) return;
      this.view.body.focus();
      document.execCommand(command, false, null);
    });
    return b;
  }

  sizeSelect(current) {
    const select = document.createElement('select');
    select.className = 'absolute-note-inline-size';
    select.title = getText('font_size');
    const sizes = SIZE_OPTIONS.includes(current) ? SIZE_OPTIONS : [...SIZE_OPTIONS, current];
    sizes.forEach((px) => {
      const opt = document.createElement('option');
      opt.value = String(px);
      opt.textContent = px + 'px';
      select.appendChild(opt);
    });
    select.value = String(current);
    select.addEventListener('change', () => {
      const px = parseInt(select.value, 10);
      if (isNaN(px) || !this.view) return;
      this.view.body.focus();
      if (this.savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(this.savedRange);
      }
      this.applyFontSize(Math.min(FONT_SIZE_RANGE[1], Math.max(FONT_SIZE_RANGE[0], px)));
    });
    return select;
  }

  // execCommand only knows the legacy 1–7 sizes: apply size 7, then turn those <font> tags into
  // spans with the exact pixel size.
  applyFontSize(px) {
    const body = this.view.body;
    document.execCommand('fontSize', false, '7');
    body.querySelectorAll('font').forEach((font) => {
      const span = document.createElement('span');
      span.style.fontSize = px + 'px';
      span.append(...font.childNodes);
      font.replaceWith(span);
    });
  }
}
