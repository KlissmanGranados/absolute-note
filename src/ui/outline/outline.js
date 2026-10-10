import { getText, setLang } from '../../shared/i18n.js';
import { MSG, NOTE_CMD, listen, sendToRuntime, sendToTab } from '../../shared/messages.js';
import { loadLang, loadNotes, onLangChanged, onNotesChanged } from '../../shared/store.js';
import { renderOutlineList } from '../shared/outline-list.js';

// Detached outline window. It reads the followed page's notes from storage and sends every action
// to that tab's content script, which owns the notes.

const els = {
  title: document.getElementById('title'),
  list: document.getElementById('notes'),
  empty: document.getElementById('empty'),
  lost: document.getElementById('lost'),
  addNote: document.getElementById('add-note'),
};

let ctx = null;
let unsubscribe = null;
let lastNotes = [];

function showLost() {
  els.lost.textContent = getText('outline_target_lost');
  els.lost.hidden = false;
  els.empty.hidden = true;
}

function render(notes) {
  lastNotes = notes;
  els.lost.hidden = true;
  els.empty.hidden = notes.length > 0;
  els.empty.textContent = getText('no_notes_empty');
  els.title.textContent = getText('outline_title_count', { count: notes.length });
  renderOutlineList(els.list, notes, {
    onSelect: (id) => command(NOTE_CMD.SCROLL_TO, id),
    onToggleLock: (id) => command(NOTE_CMD.TOGGLE_LOCK, id),
    onEdit: (id) => command(NOTE_CMD.EDIT, id),
    onDelete: (id) => command(NOTE_CMD.DELETE, id),
  });
}

async function refresh() {
  if (!ctx) {
    els.title.textContent = getText('outline_title');
    els.list.replaceChildren();
    showLost();
    return;
  }
  const pageUrl = ctx.pageUrl;
  const notes = await loadNotes(pageUrl);
  if (ctx && ctx.pageUrl === pageUrl) render(notes);
}

function setCtx(next) {
  ctx = next && next.tabId != null && next.pageUrl ? next : null;
  if (unsubscribe) unsubscribe();
  unsubscribe = ctx ? onNotesChanged(ctx.pageUrl, render) : null;
  refresh();
}

async function command(cmd, id) {
  if (!ctx) {
    showLost();
    return;
  }
  const response = await sendToTab(ctx.tabId, { type: MSG.NOTE_COMMAND, cmd, id, pageUrl: ctx.pageUrl });
  if (response && response.ok) return;
  if (!response) {
    showLost();
    return;
  }
  // The tab moved on to another page: pick up the current context.
  setCtx(await sendToRuntime({ type: MSG.GET_OUTLINE_CONTEXT }));
}

function applyLang() {
  els.addNote.textContent = getText('create_note');
  if (ctx) render(lastNotes);
  else refresh();
}

els.addNote.addEventListener('click', () => command(NOTE_CMD.ADD, null));

listen({
  [MSG.OUTLINE_CONTEXT_CHANGED]: (message) => {
    setCtx(message.ctx);
  },
});

onLangChanged((lang) => {
  setLang(lang);
  applyLang();
});

(async () => {
  const lang = await loadLang();
  if (lang) setLang(lang);
  els.addNote.textContent = getText('create_note');
  setCtx(await sendToRuntime({ type: MSG.GET_OUTLINE_CONTEXT }));
})();
