const MENU_PARENT = 'absolute-note-parent';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_PARENT,
    title: 'Absolute Note',
    contexts: ['page', 'selection', 'image', 'link', 'editable'],
  });

  chrome.contextMenus.create({
    id: 'absolute-note-create',
    parentId: MENU_PARENT,
    title: 'Agregar nota',
    contexts: ['page', 'selection', 'image', 'link', 'editable'],
  });

  chrome.contextMenus.create({
    id: 'absolute-note-outline',
    parentId: MENU_PARENT,
    title: 'Ver esquema',
    contexts: ['page', 'selection', 'image', 'link', 'editable'],
  });

  chrome.contextMenus.create({
    id: 'absolute-note-export',
    parentId: MENU_PARENT,
    title: 'Exportar notas (JSON)',
    contexts: ['page', 'selection', 'image', 'link', 'editable'],
  });

  chrome.contextMenus.create({
    id: 'absolute-note-import',
    parentId: MENU_PARENT,
    title: 'Importar notas (JSON)',
    contexts: ['page', 'selection', 'image', 'link', 'editable'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'absolute-note-create') {
    chrome.tabs.sendMessage(tab.id, { action: 'createNote' });
  } else if (info.menuItemId === 'absolute-note-outline') {
    chrome.tabs.sendMessage(tab.id, { action: 'toggleOutline' });
  } else if (info.menuItemId === 'absolute-note-export') {
    chrome.tabs.sendMessage(tab.id, { action: 'exportNotes' });
  } else if (info.menuItemId === 'absolute-note-import') {
    chrome.tabs.sendMessage(tab.id, { action: 'importNotes' });
  }
});
