import { OUTLINE_CTX_KEY } from '../shared/constants.js';
import { ext } from '../shared/ext.js';
import { MSG, listen, sendToRuntime } from '../shared/messages.js';
import { runMigrations } from '../shared/migrate.js';

// The detached outline window shows the notes of one tab. Its context is
// { windowId, tabId, pageUrl } and lives in storage.session so it survives the worker being suspended.

async function getCtx() {
  try {
    const result = await ext().storage.session.get(OUTLINE_CTX_KEY);
    return result[OUTLINE_CTX_KEY] || null;
  } catch {
    return null;
  }
}

async function setCtx(ctx) {
  try {
    await ext().storage.session.set({ [OUTLINE_CTX_KEY]: ctx });
  } catch {
    // storage.session unavailable: the window keeps its previous context.
  }
  if (ctx) sendToRuntime({ type: MSG.OUTLINE_CONTEXT_CHANGED, ctx });
}

async function openOutlineWindow(tabId, pageUrl) {
  const existing = await getCtx();
  if (existing && existing.windowId != null) {
    try {
      await ext().windows.update(existing.windowId, { focused: true });
      await setCtx({ windowId: existing.windowId, tabId, pageUrl });
      return;
    } catch {
      // The window was closed without us noticing; open a new one.
    }
  }
  const win = await ext().windows.create({
    url: ext().runtime.getURL('outline.html'),
    type: 'popup',
    width: 420,
    height: 480,
  });
  await setCtx({ windowId: win.id, tabId, pageUrl });
}

listen({
  [MSG.OPEN_OUTLINE_WINDOW]: async (message, sender) => {
    if (!sender.tab) return { ok: false };
    await openOutlineWindow(sender.tab.id, message.pageUrl);
    return { ok: true };
  },
  [MSG.GET_OUTLINE_CONTEXT]: async () => (await getCtx()) || { tabId: null, pageUrl: null },
  // SPA navigation in the tab the outline window follows.
  [MSG.PAGE_URL_CHANGED]: async (message, sender) => {
    const ctx = await getCtx();
    if (ctx && sender.tab && ctx.tabId === sender.tab.id && sender.frameId === 0 && ctx.pageUrl !== message.pageUrl) {
      await setCtx({ ...ctx, pageUrl: message.pageUrl });
    }
  },
});

ext().windows.onRemoved.addListener(async (windowId) => {
  const ctx = await getCtx();
  if (ctx && ctx.windowId === windowId) await setCtx(null);
});

ext().tabs.onRemoved.addListener(async (tabId) => {
  const ctx = await getCtx();
  if (ctx && ctx.tabId === tabId) await setCtx({ ...ctx, tabId: null });
});

ext().runtime.onInstalled.addListener(() => {
  runMigrations().catch((e) => console.error('Absolute Note: storage migration failed', e));
});
