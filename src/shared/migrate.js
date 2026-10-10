import {
  SCHEMA_KEY,
  SCHEMA_VERSION,
  hiddenStateKey,
  isNotesEntry,
  notesKey,
  outlineStateKey,
  pageUrlFromNotesKey,
  parseUiStateKey,
} from './constants.js';
import { normalizeNotes } from './schema.js';
import { normalizePageUrl } from './url.js';
import { applyChanges, loadAll } from './store.js';

// v1 → v2: notes keyed by raw location.href are moved to normalizePageUrl() keys (notes saved under
// several anchors of the same page are merged by id), every note is normalized, and per-page UI
// state that only recorded the default value is dropped.
export function planMigration(all) {
  const set = {};
  const remove = new Set();

  const notesEntries = Object.entries(all).filter(([key, value]) => isNotesEntry(key, value));
  // Visit keys that are already normalized first so their notes win on duplicate ids.
  const targetOf = (key) => notesKey(normalizePageUrl(pageUrlFromNotesKey(key)));
  notesEntries.sort(([a], [b]) => Number(targetOf(b) === b) - Number(targetOf(a) === a));

  const merged = new Map();
  for (const [key, value] of notesEntries) {
    const target = targetOf(key);
    const notes = merged.get(target) || [];
    const ids = new Set(notes.map((n) => n.id));
    for (const note of normalizeNotes(value)) {
      if (!ids.has(note.id)) {
        notes.push(note);
        ids.add(note.id);
      }
    }
    merged.set(target, notes);
    if (key !== target) remove.add(key);
  }
  for (const [target, notes] of merged) {
    if (notes.length) set[target] = notes;
    else if (target in all) remove.add(target);
  }

  for (const [key, value] of Object.entries(all)) {
    const parsed = typeof value === 'string' ? parseUiStateKey(key) : null;
    if (!parsed) continue;
    const pageUrl = normalizePageUrl(parsed.pageUrl);
    const keep =
      (parsed.kind === 'outline' && value === 'visible') || (parsed.kind === 'hidden' && value === 'hidden');
    const target = parsed.kind === 'outline' ? outlineStateKey(pageUrl) : hiddenStateKey(pageUrl);
    if (keep) set[target] = value;
    if (!keep || key !== target) remove.add(key);
  }

  for (const key of Object.keys(set)) remove.delete(key);
  set[SCHEMA_KEY] = SCHEMA_VERSION;
  return { set, remove: [...remove] };
}

export async function runMigrations() {
  const all = await loadAll();
  if ((all[SCHEMA_KEY] || 1) >= SCHEMA_VERSION) return;
  await applyChanges(planMigration(all));
}
