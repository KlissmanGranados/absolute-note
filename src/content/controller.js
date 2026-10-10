import { MIN_NOTE_HEIGHT, MIN_NOTE_WIDTH, generateId } from '../shared/constants.js';
import { normalizeNote } from '../shared/schema.js';
import * as store from '../shared/store.js';
import {
  claimContainer,
  findScrollContainer,
  isDefaultContainer,
  mountPoint,
  originOf,
  pageElementAt,
  releaseContainer,
} from './container.js';
import { InlineEditor } from './inline-editor.js';
import { NoteView } from './note-view.js';
import { eventPathMatches } from './shadow.js';

const DRAG_THRESHOLD = 4;

// Follows one pointer until it is released, with listeners that only exist during the gesture.
function trackPointer(down, { move, end }) {
  const pointerId = down.pointerId;
  const onMove = (e) => {
    if (e.pointerId !== pointerId) return;
    e.stopPropagation();
    move(e);
  };
  const onEnd = (e) => {
    if (e.pointerId !== pointerId) return;
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onEnd, true);
    window.removeEventListener('pointercancel', onEnd, true);
    end(e);
  };
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onEnd, true);
  window.addEventListener('pointercancel', onEnd, true);
}

// Owns the notes of one page: the in-memory state, their views and every write to storage.
// Views and panels only report user intent to it.
export class NotesController {
  constructor(pageUrl, { onChange }) {
    this.pageUrl = pageUrl;
    this.onChange = onChange;
    this.notes = new Map();
    this.views = new Map();
    this.container = null;
    this.gestureId = null;
    this.syncPending = false;
    this.destroyed = false;
    this.editor = new InlineEditor({ onCommit: (id, html) => this.setText(id, html) });
    // Changes made by other tabs, the outline window or an import.
    this.unsubscribe = store.onNotesChanged(pageUrl, () => this.scheduleSync());
  }

  get size() {
    return this.notes.size;
  }

  list() {
    return [...this.notes.values()];
  }

  async load() {
    const notes = await store.loadNotes(this.pageUrl);
    if (this.destroyed) return;
    // A local write landed while reading: wait for it and read again rather than show stale data.
    if (store.hasPendingWrites(this.pageUrl)) {
      this.scheduleSync();
      return;
    }
    this.reconcile(notes);
  }

  // storage.onChanged also reports this context's own writes. Reading back once they settle
  // avoids applying an intermediate state over newer local changes.
  scheduleSync() {
    if (this.syncPending) return;
    this.syncPending = true;
    store.whenWritesSettle(this.pageUrl).then(() => {
      this.syncPending = false;
      if (!this.destroyed) this.load().catch(() => {});
    });
  }

  reconcile(notes) {
    const incoming = new Set();
    for (const note of notes) {
      incoming.add(note.id);
      const view = this.views.get(note.id);
      if (!view) {
        this.notes.set(note.id, note);
        this.mount(note);
        continue;
      }
      if (note.id === this.gestureId) continue;
      const editing = this.editor.editingId === note.id;
      const next = editing ? { ...note, text: this.notes.get(note.id).text } : note;
      this.notes.set(note.id, next);
      view.update(next, { keepText: editing });
    }
    for (const id of [...this.notes.keys()]) {
      if (!incoming.has(id)) this.unmount(id);
    }
    this.changed();
  }

  mount(note) {
    const id = note.id;
    const view = new NoteView(note, {
      onColor: (i) => this.update(id, { colorIndex: i }),
      onDelete: () => this.remove(id),
      onEditRequest: () => this.edit(id),
      onPointerDown: (e) => this.startDrag(id, e),
      onResizeStart: (e) => this.startResize(id, e),
    });
    this.views.set(id, view);
    mountPoint(this.container).appendChild(view.el);
    return view;
  }

  unmount(id) {
    if (this.editor.editingId === id) this.editor.finish({ commit: false });
    const view = this.views.get(id);
    if (view) view.destroy();
    this.views.delete(id);
    this.notes.delete(id);
  }

  changed() {
    if (this.onChange) this.onChange(this);
  }

  write(promise) {
    promise.catch(() => {});
  }

  update(id, patch, { render = true } = {}) {
    const note = this.notes.get(id);
    if (!note) return false;
    const next = { ...note, ...patch };
    this.notes.set(id, next);
    const view = this.views.get(id);
    if (render && view) view.update(next, { keepText: this.editor.editingId === id });
    this.write(store.patchNote(this.pageUrl, id, patch));
    this.changed();
    return true;
  }

  async createAt(clientX, clientY) {
    this.ensureContainer(pageElementAt(clientX, clientY));
    const settings = await store.loadSettings();
    if (this.destroyed) return null;
    const note = normalizeNote({
      id: generateId(),
      anchor: 'top',
      w_px: settings.width,
      h_px: settings.height,
      fontSize: settings.fontSize,
    });
    this.notes.set(note.id, note);
    const view = this.mount(note);
    // Placed at (0, 0) first to measure where the container's origin is on screen.
    const origin = originOf(view.el);
    note.posX_px = clientX - origin.x;
    note.posY_px = clientY - origin.y - settings.height / 2;
    view.setPosition(note.posX_px, note.posY_px);
    this.write(store.addNote(this.pageUrl, note));
    this.editor.start(view, note);
    this.changed();
    return note.id;
  }

  setText(id, html) {
    const note = this.notes.get(id);
    if (!note) return;
    const view = this.views.get(id);
    // Re-render from the sanitized HTML in place of the DOM produced while editing.
    if (view) view.markTextRendered(null);
    if (note.text === html) {
      if (view) view.update(note);
      this.changed();
      return;
    }
    this.update(id, { text: html });
  }

  remove(id) {
    if (!this.notes.has(id)) return false;
    this.unmount(id);
    this.write(store.removeNote(this.pageUrl, id));
    this.changed();
    return true;
  }

  toggleLock(id) {
    const note = this.notes.get(id);
    if (!note) return false;
    if (!note.locked && this.editor.editingId === id) this.editor.finish();
    return this.update(id, { locked: !this.notes.get(id).locked });
  }

  edit(id) {
    const note = this.notes.get(id);
    const view = this.views.get(id);
    if (!note || !view || note.locked) return false;
    this.editor.start(view, note);
    return true;
  }

  scrollTo(id) {
    const view = this.views.get(id);
    if (!view) return false;
    view.highlight();
    return true;
  }

  startDrag(id, e) {
    const note = this.notes.get(id);
    const view = this.views.get(id);
    if (!note || !view || e.button !== 0 || !e.isPrimary) return;
    if (this.editor.editingId === id && eventPathMatches(e, '.absolute-note-body')) return;
    if (eventPathMatches(e, 'select, input, button, a, .absolute-note-color-dot, .absolute-note-resize, .absolute-note-inline-toolbar')) return;
    if (note.locked) return;
    // Mouse: no text selection or focus change while dragging. Touch: the header's touch-action
    // already keeps the page from scrolling.
    if (e.pointerType === 'mouse') e.preventDefault();

    const el = view.el;
    const startX = e.clientX;
    const startY = e.clientY;
    let grabX = 0;
    let grabY = 0;
    let pos = null;
    trackPointer(e, {
      move: (ev) => {
        if (!pos) {
          if ((ev.clientX - startX) ** 2 + (ev.clientY - startY) ** 2 < DRAG_THRESHOLD ** 2) return;
          const r = el.getBoundingClientRect();
          grabX = startX - (r.left + r.width / 2);
          grabY = startY - r.top;
          this.gestureId = id;
          view.setDragging(true);
        }
        const origin = originOf(el);
        pos = { x: ev.clientX - grabX - origin.x, y: ev.clientY - grabY - origin.y };
        view.setPosition(pos.x, pos.y);
      },
      end: () => {
        if (!pos) return;
        view.setDragging(false);
        this.gestureId = null;
        this.update(id, { posX_px: pos.x, posY_px: pos.y });
      },
    });
  }

  // The grip resizes both ways. Height is stored as the note's minimum height: the note still grows
  // with its text, so dragging up never shrinks it below its content.
  startResize(id, e) {
    const note = this.notes.get(id);
    const view = this.views.get(id);
    if (!note || !view || e.button !== 0 || !e.isPrimary || !view.el.offsetWidth) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = view.el.offsetWidth;
    const startH = view.el.offsetHeight;
    const startPosX = note.posX_px;
    let size = null;
    this.gestureId = id;
    trackPointer(e, {
      move: (ev) => {
        const width = Math.max(MIN_NOTE_WIDTH, startW + (ev.clientX - startX));
        const minHeight = Math.max(MIN_NOTE_HEIGHT, startH + (ev.clientY - startY));
        view.setSize(width, minHeight);
        // posX_px is the horizontal center: shift it by half the actual growth (max-width may cap it)
        // so the left edge stays put and the grip stays under the pointer.
        size = { minHeight, posX: startPosX + (view.el.offsetWidth - startW) / 2 };
        view.setPosition(size.posX, note.posY_px);
      },
      end: () => {
        this.gestureId = null;
        if (!size) return;
        this.update(id, {
          w_px: Math.round(view.el.offsetWidth),
          h_px: Math.round(size.minHeight),
          posX_px: size.posX,
        });
      },
    });
  }

  ensureContainer(refEl) {
    const detected = findScrollContainer(refEl || document.body);
    const current = this.container;
    if (current && current.isConnected && (!isDefaultContainer(current) || isDefaultContainer(detected))) return;
    this.switchContainer(detected, { preservePosition: true });
  }

  // Moves every note into `next`. With preservePosition, visible notes keep their place on screen
  // and the new coordinates are saved; otherwise they are placed from their stored coordinates.
  switchContainer(next, { preservePosition }) {
    if (this.container !== next) releaseContainer(this.container);
    this.container = next;
    claimContainer(next);
    for (const [id, view] of this.views) {
      if (view.el.parentNode === mountPoint(next)) continue;
      const rect = preservePosition && view.el.isConnected ? view.el.getBoundingClientRect() : null;
      mountPoint(next).appendChild(view.el);
      if (!rect || !rect.width) continue;
      const origin = originOf(view.el);
      this.update(id, { posX_px: rect.left + rect.width / 2 - origin.x, posY_px: rect.top - origin.y });
    }
  }

  // Called while the page's DOM changes: SPAs often mount their real scroll container after load,
  // or replace it on navigation.
  checkContainer() {
    const current = this.container;
    if (current && current.isConnected && !isDefaultContainer(current)) return;
    const cx = Math.round(window.innerWidth / 2);
    const cy = Math.round(window.innerHeight / 2);
    if (current && !current.isConnected) {
      this.switchContainer(findScrollContainer(pageElementAt(cx, cy) || document.body), { preservePosition: false });
      return;
    }
    const first = [...this.views.values()].find((v) => {
      const r = v.el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (!first) return;
    const r = first.el.getBoundingClientRect();
    const pageEl = pageElementAt(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    if (!pageEl) {
      const viewportEl = pageElementAt(cx, cy);
      if (!viewportEl) return;
      const detected = findScrollContainer(viewportEl);
      if (isDefaultContainer(detected) || detected === current) return;
      this.switchContainer(detected, { preservePosition: false });
      return;
    }
    if (!isDefaultContainer(findScrollContainer(pageEl))) this.ensureContainer(pageEl);
  }

  applyLang() {
    for (const view of this.views.values()) view.applyLang();
  }

  // `commit` saves a note that is being edited (e.g. when navigating away inside an SPA).
  destroy({ commit = true } = {}) {
    if (this.destroyed) return;
    if (this.editor.editingId) this.editor.finish({ commit });
    this.destroyed = true;
    try {
      this.unsubscribe();
    } catch {
      // Extension context already gone.
    }
    for (const view of this.views.values()) view.destroy();
    this.views.clear();
    this.notes.clear();
    releaseContainer(this.container);
    this.container = null;
  }
}
