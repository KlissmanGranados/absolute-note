if (typeof importScripts === 'function') {
  importScripts('locales.js', 'sanitize.js');
}

const STORAGE_PREFIX = 'absolute_note_';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('absolute_note_lang', (result) => {
    if (result.absolute_note_lang) setLang(result.absolute_note_lang);
    chrome.contextMenus.create({
      id: 'absolute-note-create',
      title: getText('add_note'),
      contexts: ['page', 'selection', 'image', 'link', 'editable'],
    });
  });
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.absolute_note_lang) {
    const lang = changes.absolute_note_lang.newValue;
    setLang(lang);
    chrome.contextMenus.update('absolute-note-create', { title: getText('add_note') });
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id == null) return;
        chrome.tabs.sendMessage(tab.id, { action: 'setLang', lang }, () => { void chrome.runtime.lastError; });
      });
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'absolute-note-create') {
    chrome.tabs.sendMessage(tab.id, { action: 'createNote' }, () => { void chrome.runtime.lastError; });
  }
});

function mergeImportedNotes(existing, imported) {
  const merged = {};
  let added = 0;
  for (const key in existing) {
    if (key.indexOf(STORAGE_PREFIX) === 0 && Array.isArray(existing[key])) {
      merged[key] = existing[key].slice();
    }
  }
  for (const key in imported) {
    if (key.indexOf(STORAGE_PREFIX) !== 0) continue;
    const value = imported[key];
    if (!Array.isArray(value)) continue;
    const notes = value
      .filter((n) => n && typeof n === 'object')
      .map((n) => {
        const note = sanitizeNote(n);
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
      const ids = new Set(merged[key].map((n) => n.id));
      notes.forEach((note) => {
        if (!ids.has(note.id)) {
          merged[key].push(note);
          ids.add(note.id);
          added++;
        }
      });
    }
  }
  return { merged, added };
}

function notifyAllTabs(action) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id == null) return;
      chrome.tabs.sendMessage(tab.id, { action }, () => { void chrome.runtime.lastError; });
    });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'importNotes') return;
  (async () => {
    try {
      const imported = JSON.parse(msg.json);
      if (typeof imported !== 'object' || imported === null || Array.isArray(imported)) {
        throw new Error('invalid structure');
      }
      const existing = await chrome.storage.local.get(null);
      const { merged, added } = mergeImportedNotes(existing, imported);
      if (Object.keys(merged).length) {
        await chrome.storage.local.set(merged);
      }
      const after = await chrome.storage.local.get(null);
      let pages = 0;
      let total = 0;
      for (const k in after) {
        if (k.indexOf(STORAGE_PREFIX) === 0 && Array.isArray(after[k])) {
          pages++;
          total += after[k].length;
        }
      }
      if (added > 0) notifyAllTabs('reloadNotes');
      sendResponse({ ok: true, added, pages, total });
    } catch (e) {
      sendResponse({ ok: false, error: e && e.message ? e.message : String(e) });
    }
  })();
  return true;
});
