function sendToActiveTab(action, extra) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, Object.assign({ action }, extra), () => { void chrome.runtime.lastError; });
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
  var btnHide = document.getElementById('btn-hide');
  if (btnHide) btnHide.classList.toggle('btn--disabled', !enabled);
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
  document.getElementById('lbl-customize').textContent = getText('customize_notes');
  document.getElementById('lbl-prefs-title').textContent = getText('customize_notes');
  document.getElementById('lbl-prefs-width').textContent = getText('note_width');
  document.getElementById('lbl-prefs-height').textContent = getText('note_height');
  document.getElementById('lbl-prefs-font').textContent = getText('note_font_size');
  document.getElementById('btn-prefs-save').querySelector('.label').textContent = getText('save');
  document.getElementById('btn-prefs-back').querySelector('.label').textContent = getText('back');
}

function applyLang(lang) {
  setLang(lang);
  updateUI();
  updateHideLabel();
  sendToActiveTab('setLang', { lang: lang });
}

function showStatus(elId, text, isError) {
  var el = document.getElementById(elId);
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? '#c00' : '#2e7d32';
  clearTimeout(el._statusTimer);
  el._statusTimer = setTimeout(function () { el.textContent = ''; }, 3000);
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

function openSettings() {
  chrome.storage.local.get('absolute_note_settings', (res) => {
    var s = res.absolute_note_settings || {};
    document.getElementById('in-width').value = s.width || 170;
    document.getElementById('in-height').value = s.height || 325;
    document.getElementById('in-font').value = s.fontSize || 14;
    document.getElementById('main-view').style.display = 'none';
    document.getElementById('settings-view').style.display = '';
  });
}

document.getElementById('btn-customize').addEventListener('click', openSettings);

document.getElementById('btn-prefs-back').addEventListener('click', () => {
  document.getElementById('settings-view').style.display = 'none';
  document.getElementById('main-view').style.display = '';
});

document.getElementById('btn-prefs-save').addEventListener('click', () => {
  function clamp(v, lo, hi, def) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return def;
    return Math.min(hi, Math.max(lo, n));
  }
  var settings = {
    width: clamp(document.getElementById('in-width').value, 80, 2000, 170),
    height: clamp(document.getElementById('in-height').value, 80, 2000, 325),
    fontSize: clamp(document.getElementById('in-font').value, 8, 72, 14),
  };
  document.getElementById('in-width').value = settings.width;
  document.getElementById('in-height').value = settings.height;
  document.getElementById('in-font').value = settings.fontSize;
  chrome.storage.local.set({ absolute_note_settings: settings }, () => {
    showStatus('prefs-status', getText('prefs_saved'), false);
    setTimeout(() => {
      document.getElementById('settings-view').style.display = 'none';
      document.getElementById('main-view').style.display = '';
    }, 800);
  });
});

document.getElementById('btn-export').addEventListener('click', () => {
  chrome.storage.local.get(null, (data) => {
    if (chrome.runtime.lastError) return;
    var prefix = 'absolute_note_';
    var filtered = {};
    var count = 0;
    for (var key in data) {
      if (key.indexOf(prefix) === 0) {
        filtered[key] = data[key];
        count += data[key].length;
      }
    }
    if (count === 0) {
      showStatus('status', getText('no_notes_export'), true);
      return;
    }
    var json = JSON.stringify(filtered, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'absolute-notes-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    showStatus('status', getText('export_ok', { count: count }), false);
  });
});

document.getElementById('btn-import').addEventListener('click', () => {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', () => {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.addEventListener('load', () => {
      try {
        var imported = JSON.parse(reader.result);
        var prefix = 'absolute_note_';
        var merged = {};
        chrome.storage.local.get(null, (existing) => {
          if (chrome.runtime.lastError) return;
          for (var key in existing) {
            if (key.indexOf(prefix) === 0) merged[key] = existing[key];
          }
          var added = 0;
          for (var key in imported) {
            if (key.indexOf(prefix) !== 0) continue;
            if (!merged[key]) {
              merged[key] = imported[key].map(sanitizeNote);
              added += merged[key].length;
            } else {
              var existingIds = new Set(merged[key].map(function (n) { return n.id; }));
              imported[key].forEach(function (note) {
                if (!existingIds.has(note.id)) {
                  merged[key].push(sanitizeNote(note));
                  existingIds.add(note.id);
                  added++;
                }
              });
            }
          }
          chrome.storage.local.set(merged, () => {
            if (chrome.runtime.lastError) return;
            showStatus('status', getText('import_ok', { count: added }), false);
            sendToActiveTab('reloadNotes');
          });
        });
      } catch (e) {
        showStatus('status', getText('import_invalid'), true);
      }
    });
    reader.readAsText(file);
  });
  input.click();
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
