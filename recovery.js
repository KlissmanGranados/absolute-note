var STORAGE_PREFIX = 'absolute_note_';

function showSpinner(show) {
  var s = document.getElementById('spinner');
  if (s) s.hidden = !show;
}

function showStatus(text, isError) {
  var el = document.getElementById('status');
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? '#c00' : '#2e7d32';
}

function applyLang() {
  document.getElementById('lbl-title').textContent = getText('recovery');
  document.getElementById('lbl-export').textContent = getText('export_notes');
  document.getElementById('lbl-import').textContent = getText('import_notes');
}

chrome.storage.local.get('absolute_note_lang', (result) => {
  setLang(result.absolute_note_lang || 'en');
  applyLang();
});

document.getElementById('btn-export').addEventListener('click', () => {
  showSpinner(true);
  showStatus('', false);
  chrome.storage.local.get(null, (data) => {
    showSpinner(false);
    if (chrome.runtime.lastError) {
      showStatus('Error: ' + chrome.runtime.lastError.message, true);
      return;
    }
    var filtered = {};
    var count = 0;
    for (var key in data) {
      if (key.indexOf(STORAGE_PREFIX) === 0 && Array.isArray(data[key])) {
        filtered[key] = data[key];
        count += data[key].length;
      }
    }
    if (count === 0) {
      showStatus(getText('no_notes_export'), false);
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
    showStatus(getText('export_ok', { count: count }), false);
  });
});

document.getElementById('btn-import').addEventListener('click', () => {
  var input = document.getElementById('file-input');
  input.value = '';
  input.click();
});

document.getElementById('file-input').addEventListener('change', () => {
  var file = document.getElementById('file-input').files[0];
  if (!file) return;
  showSpinner(true);
  showStatus('', false);
  var reader = new FileReader();
  reader.addEventListener('load', () => {
    chrome.runtime.sendMessage({ action: 'importNotes', json: reader.result }, (resp) => {
      showSpinner(false);
      if (chrome.runtime.lastError || !resp) {
        showStatus(getText('import_invalid'), true);
        return;
      }
      if (!resp.ok) {
        showStatus(getText('import_invalid') + ' (' + resp.error + ')', true);
        return;
      }
      if (resp.added === 0 && resp.pages === 0 && resp.total === 0) {
        showStatus(getText('import_ok', { count: 0 }), false);
        return;
      }
      showStatus(getText('import_summary', { count: resp.added, pages: resp.pages, total: resp.total }), false);
    });
  });
  reader.addEventListener('error', () => {
    showSpinner(false);
    showStatus(getText('import_invalid'), true);
  });
  reader.readAsText(file);
});
