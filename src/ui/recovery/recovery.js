import { collectNotes, isImportPayload, mergeImport } from '../../shared/backup.js';
import { getText, setLang } from '../../shared/i18n.js';
import { sanitizeHtml } from '../../shared/sanitize.js';
import { applyChanges, loadAll, loadLang } from '../../shared/store.js';

const $ = (id) => document.getElementById(id);

function showSpinner(show) {
  $('spinner').hidden = !show;
}

function showStatus(text, isError) {
  const el = $('status');
  el.textContent = text;
  el.style.color = isError ? '#c00' : '#2e7d32';
}

function errorText(e) {
  return 'Error: ' + (e && e.message ? e.message : String(e));
}

async function exportNotes() {
  showSpinner(true);
  showStatus('', false);
  try {
    const { data, count } = collectNotes(await loadAll());
    if (count === 0) {
      showStatus(getText('no_notes_export'), false);
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'absolute-notes-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showStatus(getText('export_ok', { count }), false);
  } catch (e) {
    showStatus(errorText(e), true);
  } finally {
    showSpinner(false);
  }
}

// Open tabs pick the imported notes up through storage.onChanged.
async function importText(text) {
  let imported;
  try {
    imported = JSON.parse(text);
  } catch {
    imported = null;
  }
  if (!isImportPayload(imported)) {
    showStatus(getText('import_invalid'), true);
    return;
  }
  const { set, added } = mergeImport(await loadAll(), imported, sanitizeHtml);
  await applyChanges({ set });
  const { pages, count } = collectNotes(await loadAll());
  showStatus(getText('import_summary', { count: added, pages, total: count }), false);
}

$('btn-export').addEventListener('click', exportNotes);

$('btn-import').addEventListener('click', () => {
  const input = $('file-input');
  input.value = '';
  input.click();
});

$('file-input').addEventListener('change', async () => {
  const file = $('file-input').files[0];
  if (!file) return;
  showSpinner(true);
  showStatus('', false);
  try {
    await importText(await file.text());
  } catch (e) {
    showStatus(errorText(e), true);
  } finally {
    showSpinner(false);
  }
});

(async () => {
  setLang((await loadLang()) || 'en');
  $('lbl-title').textContent = getText('recovery');
  $('lbl-export').textContent = getText('export_notes');
  $('lbl-import').textContent = getText('import_notes');
})();
