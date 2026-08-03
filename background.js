importScripts('locales.js');

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
        chrome.tabs.sendMessage(tab.id, { action: 'setLang', lang }).catch(() => {});
      });
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'absolute-note-create') {
    chrome.tabs.sendMessage(tab.id, { action: 'createNote' }).catch(() => {});
  }
});
