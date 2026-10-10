export const PREFIX = 'absolute_note_';
export const SETTINGS_KEY = PREFIX + 'settings';
export const LANG_KEY = PREFIX + 'lang';
export const THEME_KEY = PREFIX + 'theme';
export const SCHEMA_KEY = PREFIX + 'schema';
// Lives in storage.session (background only).
export const OUTLINE_CTX_KEY = PREFIX + 'outline_ctx';

// v1: one key per raw location.href. v2: keys use normalizePageUrl() and notes are normalized.
export const SCHEMA_VERSION = 2;

const OUTLINE_STATE_PREFIX = PREFIX + 'outline_';
const HIDDEN_STATE_PREFIX = PREFIX + 'hide_';

export const notesKey = (pageUrl) => PREFIX + pageUrl;
export const outlineStateKey = (pageUrl) => OUTLINE_STATE_PREFIX + pageUrl;
export const hiddenStateKey = (pageUrl) => HIDDEN_STATE_PREFIX + pageUrl;

// Notes are the only array values stored under the prefix; per-page UI state is stored as strings.
export function isNotesEntry(key, value) {
  return key.startsWith(PREFIX) && Array.isArray(value);
}

export function pageUrlFromNotesKey(key) {
  return key.slice(PREFIX.length);
}

export function parseUiStateKey(key) {
  if (key.startsWith(OUTLINE_STATE_PREFIX)) return { kind: 'outline', pageUrl: key.slice(OUTLINE_STATE_PREFIX.length) };
  if (key.startsWith(HIDDEN_STATE_PREFIX)) return { kind: 'hidden', pageUrl: key.slice(HIDDEN_STATE_PREFIX.length) };
  return null;
}

export const COLORS = [
  { bg: '#fff9c4', border: '#f0e68c', header: '#f5eaa0' },
  { bg: '#bbdefb', border: '#90caf9', header: '#90caf9' },
  { bg: '#c8e6c9', border: '#a5d6a7', header: '#a5d6a7' },
  { bg: '#f8bbd0', border: '#f48fb1', header: '#f48fb1' },
];

export const DEFAULT_SETTINGS = { width: 170, height: 325, fontSize: 14 };
export const SIZE_RANGE = [80, 2000];
export const FONT_SIZE_RANGE = [8, 72];
export const MIN_NOTE_WIDTH = 80;
export const MIN_NOTE_HEIGHT = 80;

export function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
