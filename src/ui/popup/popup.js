import { DEFAULT_SETTINGS, FONT_SIZE_RANGE, SIZE_RANGE, clampInt } from '../../shared/constants.js';
import { ext } from '../../shared/ext.js';
import { DEFAULT_LANG, getText, setLang } from '../../shared/i18n.js';
import { MSG, sendToActiveTab } from '../../shared/messages.js';
import { loadLang, loadSettings, saveLang, saveSettings, saveTheme } from '../../shared/store.js';
import { syncTheme } from '../../shared/theme.js';

const $ = (id) => document.getElementById(id);

const state = { hidden: false, hasNotes: false };
let theme = 'light';

// Shows the theme the button switches to.
const ICON_MOON = '☾';
const ICON_SUN = '☀';

function updateThemeButton() {
  const toDark = theme === 'light';
  $('lbl-theme').textContent = getText(toDark ? 'theme_to_dark' : 'theme_to_light');
  $('ico-theme').textContent = toDark ? ICON_MOON : ICON_SUN;
}

function updateButtons() {
  $('btn-hide').classList.toggle('btn--disabled', !state.hasNotes);
  $('btn-outline').classList.toggle('btn--disabled', !state.hasNotes || state.hidden);
  $('lbl-hide').textContent = getText(state.hidden ? 'show_notes' : 'hide_notes');
  $('ico-show').hidden = !state.hidden;
  $('ico-hide').hidden = state.hidden;
}

function applyLang() {
  $('lbl-add-note').textContent = getText('add_note');
  $('lbl-outline').textContent = getText('view_outline');
  $('lbl-data').textContent = getText('data');
  $('lbl-lang').textContent = getText('lang_label');
  $('lbl-customize').textContent = getText('customize_notes');
  $('lbl-prefs-title').textContent = getText('customize_notes');
  $('lbl-prefs-width').textContent = getText('note_width');
  $('lbl-prefs-height').textContent = getText('note_height');
  $('lbl-prefs-font').textContent = getText('note_font_size');
  $('btn-prefs-save').querySelector('.label').textContent = getText('save');
  $('btn-prefs-back').querySelector('.label').textContent = getText('back');
  updateButtons();
  updateThemeButton();
}

function showView(name) {
  $('main-view').style.display = name === 'main' ? '' : 'none';
  $('settings-view').style.display = name === 'settings' ? '' : 'none';
}

function showStatus(text) {
  const el = $('prefs-status');
  el.textContent = text;
  el.style.color = '#2e7d32';
  clearTimeout(el.statusTimer);
  el.statusTimer = setTimeout(() => {
    el.textContent = '';
  }, 3000);
}

$('btn-add-note').addEventListener('click', async () => {
  await sendToActiveTab({ type: MSG.CREATE_NOTE });
  window.close();
});

$('btn-hide').addEventListener('click', async () => {
  const response = await sendToActiveTab({ type: MSG.TOGGLE_HIDE_NOTES });
  if (response) state.hidden = response.hidden;
  updateButtons();
});

$('btn-outline').addEventListener('click', async () => {
  await sendToActiveTab({ type: MSG.OPEN_OUTLINE });
  window.close();
});

$('btn-customize').addEventListener('click', async () => {
  const s = await loadSettings();
  $('in-width').value = s.width;
  $('in-height').value = s.height;
  $('in-font').value = s.fontSize;
  showView('settings');
});

$('btn-prefs-back').addEventListener('click', () => showView('main'));

$('btn-prefs-save').addEventListener('click', async () => {
  const settings = {
    width: clampInt($('in-width').value, SIZE_RANGE[0], SIZE_RANGE[1], DEFAULT_SETTINGS.width),
    height: clampInt($('in-height').value, SIZE_RANGE[0], SIZE_RANGE[1], DEFAULT_SETTINGS.height),
    fontSize: clampInt($('in-font').value, FONT_SIZE_RANGE[0], FONT_SIZE_RANGE[1], DEFAULT_SETTINGS.fontSize),
  };
  $('in-width').value = settings.width;
  $('in-height').value = settings.height;
  $('in-font').value = settings.fontSize;
  await saveSettings(settings);
  showStatus(getText('prefs_saved'));
  setTimeout(() => showView('main'), 800);
});

$('btn-data').addEventListener('click', () => {
  ext().tabs.create({ url: ext().runtime.getURL('data.html') });
  window.close();
});

$('btn-theme').addEventListener('click', async () => {
  theme = theme === 'light' ? 'dark' : 'light';
  updateThemeButton();
  await saveTheme(theme);
});

$('lang-select').addEventListener('change', () => {
  const lang = $('lang-select').value;
  setLang(lang);
  applyLang();
  saveLang(lang);
});

(async () => {
  $('version').textContent = 'v' + ext().runtime.getManifest().version;
  const lang = (await loadLang()) || DEFAULT_LANG;
  $('lang-select').value = lang;
  setLang(lang);
  syncTheme(document.documentElement, (next) => {
    theme = next;
    updateThemeButton();
  });
  applyLang();
  const response = await sendToActiveTab({ type: MSG.GET_PAGE_STATE });
  if (response) {
    state.hidden = !!response.hidden;
    state.hasNotes = !!response.hasNotes;
  }
  updateButtons();
})();
