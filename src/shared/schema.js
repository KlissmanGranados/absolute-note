import { COLORS, DEFAULT_SETTINGS, FONT_SIZE_RANGE, SIZE_RANGE, clampInt, generateId } from './constants.js';

const MAX_STORED_SIZE = 20000;

function finiteNumber(value, fallback) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : fallback;
}

// Sizes are optional: absent (or zero, as saved by older versions while notes were hidden) means
// "use the stylesheet default".
function optionalSize(value) {
  const n = finiteNumber(value, NaN);
  if (!(n > 0)) return undefined;
  return Math.min(MAX_STORED_SIZE, Math.round(n));
}

function colorIndex(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n < COLORS.length ? n : 0;
}

// Coerces a stored or imported note into the current shape. Pure (no DOM): the background
// migration uses it too. Note text is sanitized separately, where a DOM is available.
export function normalizeNote(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const note = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : generateId(),
    text: typeof raw.text === 'string' ? raw.text : '',
    locked: raw.locked === true,
    colorIndex: colorIndex(raw.colorIndex),
    anchor: 'top',
    posX_px: finiteNumber(raw.posX_px, 0),
    posY_px: finiteNumber(raw.posY_px, 0),
  };
  const w = optionalSize(raw.w_px);
  const h = optionalSize(raw.h_px);
  if (w !== undefined) note.w_px = w;
  if (h !== undefined) note.h_px = h;
  if (raw.fontSize != null) {
    const fs = clampInt(raw.fontSize, FONT_SIZE_RANGE[0], FONT_SIZE_RANGE[1], NaN);
    if (!isNaN(fs)) note.fontSize = fs;
  }
  // Notes saved before top anchoring stored the vertical center.
  if (raw.anchor !== 'top') {
    note.posY_px -= clampInt(h, SIZE_RANGE[0], SIZE_RANGE[1], DEFAULT_SETTINGS.height) / 2;
  }
  return note;
}

export function normalizeNotes(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const notes = [];
  for (const raw of list) {
    const note = normalizeNote(raw);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    notes.push(note);
  }
  return notes;
}
