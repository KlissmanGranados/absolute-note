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
