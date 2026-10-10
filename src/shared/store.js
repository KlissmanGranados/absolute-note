import { ext } from './ext.js';
import {
  DEFAULT_SETTINGS,
  FONT_SIZE_RANGE,
  LANG_KEY,
  THEME_KEY,
  SETTINGS_KEY,
  SIZE_RANGE,
  clampInt,
  hiddenStateKey,
  notesKey,
  outlineStateKey,
} from './constants.js';
import { normalizeNotes } from './schema.js';

// Every write to a page's notes is a read-modify-write of one array. Running them one at a time per
// key keeps writes issued from the same context from overwriting each other.
const queues = new Map();

function serialized(key, task) {
  const run = (queues.get(key) || Promise.resolve()).then(task);
  const tail = run.catch(() => {});
  queues.set(key, tail);
  tail.then(() => {
    if (queues.get(key) === tail) queues.delete(key);
  });
  return run;
}

async function read(key) {
  const result = await ext().storage.local.get(key);
  return result[key];
}

export function hasPendingWrites(pageUrl) {
  return queues.has(notesKey(pageUrl));
}

export function whenWritesSettle(pageUrl) {
  return queues.get(notesKey(pageUrl)) || Promise.resolve();
}

export async function loadNotes(pageUrl) {
  return normalizeNotes(await read(notesKey(pageUrl)));
}

// `mutate` receives the freshly read notes and returns the new list, or null to skip the write.
function updateNotes(pageUrl, mutate) {
  const key = notesKey(pageUrl);
  return serialized(key, async () => {
    const notes = normalizeNotes(await read(key));
    const next = mutate(notes);
    if (!next) return notes;
    if (next.length) await ext().storage.local.set({ [key]: next });
    else await ext().storage.local.remove(key);
    return next;
  });
}

export function addNote(pageUrl, note) {
  return updateNotes(pageUrl, (notes) =>
    notes.some((n) => n.id === note.id) ? notes.map((n) => (n.id === note.id ? note : n)) : [...notes, note],
  );
}

// Applies only the changed fields on top of the stored note, so other fields (and other notes)
// written meanwhile by another tab are kept. A note that no longer exists is not recreated.
export function patchNote(pageUrl, id, patch) {
  return updateNotes(pageUrl, (notes) => {
    const index = notes.findIndex((n) => n.id === id);
    if (index === -1) return null;
    const next = notes.slice();
    next[index] = { ...notes[index], ...patch };
    return next;
  });
}

export function removeNote(pageUrl, id) {
  return updateNotes(pageUrl, (notes) => (notes.some((n) => n.id === id) ? notes.filter((n) => n.id !== id) : null));
}

export function onNotesChanged(pageUrl, callback) {
  const key = notesKey(pageUrl);
  const listener = (changes, area) => {
    if (area === 'local' && key in changes) callback(normalizeNotes(changes[key].newValue));
  };
  ext().storage.onChanged.addListener(listener);
  return () => ext().storage.onChanged.removeListener(listener);
}

export async function loadSettings() {
  const raw = (await read(SETTINGS_KEY)) || {};
  return {
    width: clampInt(raw.width, SIZE_RANGE[0], SIZE_RANGE[1], DEFAULT_SETTINGS.width),
    height: clampInt(raw.height, SIZE_RANGE[0], SIZE_RANGE[1], DEFAULT_SETTINGS.height),
    fontSize: clampInt(raw.fontSize, FONT_SIZE_RANGE[0], FONT_SIZE_RANGE[1], DEFAULT_SETTINGS.fontSize),
  };
}

export function saveSettings(settings) {
  return ext().storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function loadLang() {
  return (await read(LANG_KEY)) || null;
}

export function saveLang(lang) {
  return ext().storage.local.set({ [LANG_KEY]: lang });
}

export function onLangChanged(callback) {
  const listener = (changes, area) => {
    if (area === 'local' && changes[LANG_KEY]) callback(changes[LANG_KEY].newValue);
  };
  ext().storage.onChanged.addListener(listener);
  return () => ext().storage.onChanged.removeListener(listener);
}

export async function loadTheme() {
  return (await read(THEME_KEY)) || null;
}

export function saveTheme(theme) {
  return ext().storage.local.set({ [THEME_KEY]: theme });
}

export function onThemeChanged(callback) {
  const listener = (changes, area) => {
    if (area === 'local' && changes[THEME_KEY]) callback(changes[THEME_KEY].newValue);
  };
  ext().storage.onChanged.addListener(listener);
  return () => ext().storage.onChanged.removeListener(listener);
}

// Per-page UI state is only stored while it differs from the default, so pages don't leave
// keys behind forever.
export async function loadPageUiState(pageUrl) {
  const outlineKey = outlineStateKey(pageUrl);
  const hiddenKey = hiddenStateKey(pageUrl);
  const result = await ext().storage.local.get([outlineKey, hiddenKey]);
  return {
    outlineVisible: result[outlineKey] === 'visible',
    notesHidden: result[hiddenKey] === 'hidden',
  };
}

function setFlag(key, on, value) {
  return on ? ext().storage.local.set({ [key]: value }) : ext().storage.local.remove(key);
}

export function setOutlineVisible(pageUrl, visible) {
  return setFlag(outlineStateKey(pageUrl), visible, 'visible');
}

export function setNotesHidden(pageUrl, hidden) {
  return setFlag(hiddenStateKey(pageUrl), hidden, 'hidden');
}

export function loadAll() {
  return ext().storage.local.get(null);
}

export async function applyChanges({ set = {}, remove = [] }) {
  if (Object.keys(set).length) await ext().storage.local.set(set);
  if (remove.length) await ext().storage.local.remove(remove);
}
