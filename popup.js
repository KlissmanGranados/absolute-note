function sendToActiveTab(action, extra) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, Object.assign({ action }, extra)).catch(() => {});
  });
}

var hideState = false;
var hasNotes = false;

function updateOutlineBtn() {
  var btn = document.getElementById('btn-outline');
  if (!btn) return;
  btn.classList.toggle('btn--disabled', !hasNotes || hideState);
}

function setButtonsEnabled(enabled) {
  hasNotes = enabled;
  ['btn-hide', 'btn-export', 'btn-import'].forEach(function (id) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.toggle('btn--disabled', !enabled);
  });
  updateOutlineBtn();
}

function updateHideLabel() {
  document.getElementById('lbl-hide').textContent = getText(hideState ? 'show_notes' : 'hide_notes');
  document.getElementById('ico-hide').innerHTML = hideState
    ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>'
    : '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>';
}

function updateUI() {
  document.getElementById('lbl-outline').textContent = getText('view_outline');
  document.getElementById('lbl-export').textContent = getText('export_notes');
  document.getElementById('lbl-import').textContent = getText('import_notes');
  document.getElementById('lbl-lang').textContent = getText('lang_label');
}

function applyLang(lang) {
  setLang(lang);
  updateUI();
  updateHideLabel();
  sendToActiveTab('setLang', { lang: lang });
}

document.getElementById('btn-hide').addEventListener('click', () => {
  hideState = !hideState;
  updateHideLabel();
  updateOutlineBtn();
  sendToActiveTab('toggleHideNotes');
});

document.getElementById('btn-outline').addEventListener('click', () => {
  sendToActiveTab('openOutline');
  window.close();
});

document.getElementById('btn-export').addEventListener('click', () => {
  sendToActiveTab('exportNotes');
  window.close();
});

document.getElementById('btn-import').addEventListener('click', () => {
  sendToActiveTab('importNotes');
  window.close();
});

var langSelect = document.getElementById('lang-select');
langSelect.addEventListener('change', () => {
  var lang = langSelect.value;
  chrome.storage.local.set({ absolute_note_lang: lang });
  applyLang(lang);
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs || !tabs[0]) return;
  chrome.storage.local.get('absolute_note_lang', (result) => {
    var lang = result.absolute_note_lang || 'en';
    langSelect.value = lang;
    setLang(lang);
    updateUI();
    sendToActiveTab('setLang', { lang: lang });
  });
  chrome.tabs.sendMessage(tabs[0].id, { action: 'getState' }, (resp) => {
    if (chrome.runtime.lastError || !resp) {
      setButtonsEnabled(false);
      hideState = false;
      updateHideLabel();
    } else {
      hideState = resp.hidden;
      hasNotes = resp.hasNotes;
      updateHideLabel();
      setButtonsEnabled(resp.hasNotes);
    }
  });
});
