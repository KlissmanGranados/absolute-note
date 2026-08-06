const CTX_KEY = 'absolute_note_outline_ctx';

async function getCtx() {
  try {
    const res = await chrome.storage.session.get(CTX_KEY);
    return res[CTX_KEY] || null;
  } catch (e) {
    return null;
  }
}

async function setCtx(ctx) {
  try {
    await chrome.storage.session.set({ [CTX_KEY]: ctx });
  } catch (e) {}
}

async function openOutlineWindow(senderTabId, senderUrl) {
  const existing = await getCtx();
  if (existing && existing.windowId) {
    await setCtx({ windowId: existing.windowId, tabId: senderTabId, url: senderUrl });
    try {
      await chrome.windows.update(existing.windowId, { focused: true });
    } catch (e) {
      await setCtx({ windowId: null, tabId: senderTabId, url: senderUrl });
      await spawnWindow(senderTabId, senderUrl);
    }
    return;
  }
  await spawnWindow(senderTabId, senderUrl);
}

async function spawnWindow(senderTabId, senderUrl) {
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('outline.html'),
    type: 'popup',
    width: 420,
    height: 480,
  });
  await setCtx({ windowId: win.id, tabId: senderTabId, url: senderUrl });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'openOutlineWindow') {
    let tabId = null;
    let url = null;
    if (sender && sender.tab) {
      tabId = sender.tab.id;
      url = sender.tab.url;
    }
    Promise.resolve(openOutlineWindow(tabId, url)).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg && msg.action === 'getOutlineContext') {
    Promise.resolve(getCtx()).then((ctx) => sendResponse(ctx || { tabId: null, url: null }));
    return true;
  }
  return undefined;
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const ctx = await getCtx();
  if (ctx && ctx.windowId === windowId) {
    await setCtx(null);
  }
});