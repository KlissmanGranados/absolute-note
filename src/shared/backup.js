import { isNotesEntry, notesKey, pageUrlFromNotesKey } from './constants.js';
import { normalizeNote, normalizeNotes } from './schema.js';
import { normalizePageUrl } from './url.js';

// Builds the export payload: { "absolute_note_<url>": [note, ...], ... }.
export function collectNotes(all) {
  const data = {};
  let pages = 0;
  let count = 0;
  for (const [key, value] of Object.entries(all || {})) {
    if (!isNotesEntry(key, value) || !value.length) continue;
    data[key] = value;
    pages++;
    count += value.length;
  }
  return { data, pages, count };
}

// Pages (storage keys) whose URL contains the query, case-insensitive.
export function filterPages(data, query) {
  const q = (query || '').trim().toLowerCase();
  const keys = Object.keys(data || {});
  return q ? keys.filter((k) => pageUrlFromNotesKey(k).toLowerCase().includes(q)) : keys;
}

// Subset of an export payload restricted to the given keys.
export function pickPages(data, keys) {
  const out = {};
  for (const key of keys) if (key in data) out[key] = data[key];
  return out;
}

export function isImportPayload(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Merges an export file into the existing storage contents without duplicating note ids.
// Keys from older exports are rewritten to the current page-url normalization.
// Returns the storage keys to write and how many notes were added.
export function mergeImport(existing, imported, sanitize) {
  const set = {};
  let added = 0;
  for (const [key, value] of Object.entries(imported)) {
    if (!isNotesEntry(key, value)) continue;
    const target = notesKey(normalizePageUrl(pageUrlFromNotesKey(key)));
    const merged = set[target] || normalizeNotes(existing[target]);
    const ids = new Set(merged.map((n) => n.id));
    let changed = false;
    for (const raw of value) {
      const note = normalizeNote(raw);
      if (!note || ids.has(note.id)) continue;
      note.text = sanitize(note.text);
      merged.push(note);
      ids.add(note.id);
      added++;
      changed = true;
    }
    if (changed) set[target] = merged;
  }
  return { set, added };
}
