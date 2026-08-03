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
    importText(reader.result);
  });
  reader.addEventListener('error', () => {
    showSpinner(false);
    showStatus(getText('import_invalid'), true);
  });
  reader.readAsText(file);
});

function importText(text) {
  var imported;
  try {
    imported = JSON.parse(text);
  } catch (e) {
    showSpinner(false);
    showStatus(getText('import_invalid'), true);
    return;
  }
  if (typeof imported !== 'object' || imported === null || Array.isArray(imported)) {
    showSpinner(false);
    showStatus(getText('import_invalid'), true);
    return;
  }
  chrome.storage.local.get(null, (existing) => {
    if (chrome.runtime.lastError) {
      showSpinner(false);
      showStatus('Error: ' + chrome.runtime.lastError.message, true);
      return;
    }
    var merged = {};
    var added = 0;
    for (var key in existing) {
      if (key.indexOf(STORAGE_PREFIX) === 0 && Array.isArray(existing[key])) merged[key] = existing[key].slice();
    }
    for (var key in imported) {
      if (key.indexOf(STORAGE_PREFIX) !== 0) continue;
      var value = imported[key];
      if (!Array.isArray(value)) continue;
      var notes = value
        .filter(function (n) { return n && typeof n === 'object'; })
        .map(function (n) {
          var note = sanitizeNote(n);
          if (typeof note.id !== 'string' || !note.id) {
            note.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          }
          return note;
        });
      if (!notes.length) continue;
      if (!merged[key]) {
        merged[key] = notes;
        added += notes.length;
      } else {
        var ids = new Set(merged[key].map(function (n) { return n.id; }));
        notes.forEach(function (note) {
          if (!ids.has(note.id)) {
            merged[key].push(note);
            ids.add(note.id);
            added++;
          }
        });
      }
    }
    if (Object.keys(merged).length) {
      chrome.storage.local.set(merged, () => {
        if (chrome.runtime.lastError) {
          showSpinner(false);
          showStatus(getText('import_invalid') + ' (storage: ' + chrome.runtime.lastError.message + ')', true);
          return;
        }
        finishImport(added);
      });
    } else {
      finishImport(added);
    }
  });
}

function finishImport(added) {
  chrome.storage.local.get(null, (after) => {
    var pages = 0, total = 0;
    for (var k in after) {
      if (k.indexOf(STORAGE_PREFIX) === 0 && Array.isArray(after[k])) {
        pages++;
        total += after[k].length;
      }
    }
    showSpinner(false);
    if (added === 0 && pages === 0 && total === 0) {
      showStatus(getText('import_ok', { count: 0 }), false);
    } else {
      showStatus(getText('import_summary', { count: added, pages: pages, total: total }), false);
    }
    if (added > 0) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id == null) return;
          chrome.tabs.sendMessage(tab.id, { action: 'reloadNotes' }, () => { void chrome.runtime.lastError; });
        });
      });
    }
  });
}
