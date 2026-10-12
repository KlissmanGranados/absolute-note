import { collectNotes, filterPages, isImportPayload, mergeImport, pickPages, renameKeys } from '../../shared/backup.js';
import { getText, setLang } from '../../shared/i18n.js';
import { pageUrlFromNotesKey } from '../../shared/constants.js';
import { sanitizeHtml } from '../../shared/sanitize.js';
import { applyChanges, loadAll, loadLang } from '../../shared/store.js';
import { syncTheme } from '../../shared/theme.js';

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

let pages = {};
const selected = new Set();

function visibleKeys() {
  return filterPages(pages, $('search').value);
}

function render() {
  const keys = visibleKeys();
  for (const k of [...selected]) if (!(k in pages)) selected.delete(k);
  const list = $('list');
  list.textContent = '';
  if (!keys.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = getText('no_results');
    list.appendChild(li);
  }
  for (const key of keys) {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selected.has(key);
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(key);
      else selected.delete(key);
      updateCount();
    });
    const url = document.createElement('span');
    url.className = 'url';
    const link = document.createElement('a');
    link.href = pageUrlFromNotesKey(key);
    link.textContent = pageUrlFromNotesKey(key);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.addEventListener('click', (e) => e.stopPropagation());
    url.appendChild(link);
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = String(pages[key].length);
    label.append(cb, url, n);
    li.appendChild(label);
    list.appendChild(li);
  }
  updateCount();
}

function updateCount() {
  $('count').textContent = getText('selected_count', { count: selected.size, total: Object.keys(pages).length });
  $('btn-export').disabled = selected.size === 0;
  $('btn-delete').disabled = selected.size === 0;
  $('btn-replace').disabled = selected.size === 0 || !$('replace-find').value;
}

async function refresh() {
  pages = collectNotes(await loadAll()).data;
  render();
}

async function exportNotes() {
  showSpinner(true);
  showStatus('', false);
  try {
    const data = pickPages(collectNotes(await loadAll()).data, selected);
    const count = Object.values(data).reduce((sum, notes) => sum + notes.length, 0);
    if (count === 0) {
      showStatus(getText(selected.size ? 'no_notes_export' : 'no_selection'), false);
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
  const all = collectNotes(await loadAll());
  showStatus(getText('import_summary', { count: added, pages: all.pages, total: all.count }), false);
  await refresh();
}

$('btn-export').addEventListener('click', exportNotes);
$('btn-delete').addEventListener('click', async () => {
  if (!selected.size) return;
  if (!window.confirm(getText('delete_confirm', { count: selected.size }))) return;
  showSpinner(true);
  try {
    const keys = [...selected];
    await applyChanges({ remove: keys });
    selected.clear();
    await refresh();
    showStatus(getText('delete_ok', { count: keys.length }), false);
  } catch (e) {
    showStatus(errorText(e), true);
  } finally {
    showSpinner(false);
  }
});
$('replace-find').addEventListener('input', updateCount);
$('btn-replace').addEventListener('click', async () => {
  showSpinner(true);
  showStatus('', false);
  try {
    const all = await loadAll();
    const find = $('replace-find').value;
    const replace = $('replace-with').value;
    const keys = [...selected].filter((k) => k in all);
    const r = renameKeys(all, keys, find, replace);
    if (!r.moved) {
      showStatus(getText('replace_none'), false);
      return;
    }
    const first = keys.find((k) => pageUrlFromNotesKey(k).includes(find));
    const to = pageUrlFromNotesKey(first).split(find).join(replace);
    const merged = r.merged ? getText('replace_merged', { count: r.merged }) : '';
    if (!window.confirm(getText('replace_confirm', { count: r.moved, from: pageUrlFromNotesKey(first), to, merged }))) return;
    await applyChanges({ set: r.set, remove: r.remove });
    selected.clear();
    await refresh();
    showStatus(getText('replace_ok', { count: r.moved }), false);
  } catch (e) {
    showStatus(errorText(e), true);
  } finally {
    showSpinner(false);
  }
});
$('search').addEventListener('input', render);
$('btn-select-all').addEventListener('click', () => {
  for (const k of visibleKeys()) selected.add(k);
  render();
});
$('btn-deselect-all').addEventListener('click', () => {
  for (const k of visibleKeys()) selected.delete(k);
  render();
});

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
  syncTheme(document.documentElement);
  setLang((await loadLang()) || 'en');
  $('lbl-title').textContent = getText('data');
  $('lbl-export').textContent = getText('export_selected');
  $('lbl-delete').textContent = getText('delete_selected');
  $('replace-find').placeholder = getText('replace_find');
  $('replace-with').placeholder = getText('replace_with');
  $('lbl-replace').textContent = getText('replace_selected');
  $('search').placeholder = getText('search_url');
  $('btn-select-all').textContent = getText('select_all');
  $('btn-deselect-all').textContent = getText('deselect_all');
  $('lbl-import').textContent = getText('import_notes');
  await refresh();
})();
