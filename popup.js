function sendToActiveTab(action, extra) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, Object.assign({ action }, extra)).catch(() => {});
  });
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
  sendToActiveTab('setLang', { lang: lang });
}

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

chrome.storage.local.get('absolute_note_lang', (result) => {
  var lang = result.absolute_note_lang || 'en';
  langSelect.value = lang;
  applyLang(lang);
});
