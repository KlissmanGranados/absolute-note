import { loadTheme, onThemeChanged } from './store.js';

export const THEMES = ['light', 'dark'];

// An explicit choice wins; until one is made the theme follows the browser's color scheme.
export function resolveTheme(stored) {
  if (THEMES.includes(stored)) return stored;
  const dark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  return dark ? 'dark' : 'light';
}

export function applyTheme(el, theme) {
  el.setAttribute('data-theme', theme);
}

// Calls `onTheme` with the resolved theme: first right away from the browser's color scheme (no
// flash), then with the stored choice, then on every later change.
export function watchTheme(onTheme) {
  onTheme(resolveTheme(null));
  loadTheme().then((stored) => onTheme(resolveTheme(stored)), () => {});
  return onThemeChanged((next) => onTheme(resolveTheme(next)));
}

// Keeps `el` (an extension page's <html>) in the chosen theme. `onChange(theme)` runs on every update.
export function syncTheme(el, onChange) {
  return watchTheme((theme) => {
    applyTheme(el, theme);
    if (onChange) onChange(theme);
  });
}
