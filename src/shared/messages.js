import { ext } from './ext.js';

export const MSG = {
  // popup / outline window → content script (top frame)
  CREATE_NOTE: 'createNote',
  GET_PAGE_STATE: 'getPageState',
  OPEN_OUTLINE: 'openOutline',
  TOGGLE_HIDE_NOTES: 'toggleHideNotes',
  NOTE_COMMAND: 'noteCommand',
  // content script / outline window → background
  OPEN_OUTLINE_WINDOW: 'openOutlineWindow',
  GET_OUTLINE_CONTEXT: 'getOutlineContext',
  PAGE_URL_CHANGED: 'pageUrlChanged',
  // background → outline window
  OUTLINE_CONTEXT_CHANGED: 'outlineContextChanged',
};

export const NOTE_CMD = {
  ADD: 'add',
  SCROLL_TO: 'scrollTo',
  EDIT: 'edit',
  DELETE: 'delete',
  TOGGLE_LOCK: 'toggleLock',
};

// Messages for a tab go to its top frame only; subframes don't take commands.
// Resolves to undefined when nothing is listening (restricted page, no content script, …).
export async function sendToTab(tabId, message) {
  try {
    return await ext().tabs.sendMessage(tabId, message, { frameId: 0 });
  } catch {
    return undefined;
  }
}

export async function sendToActiveTab(message) {
  const [tab] = await ext().tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) return undefined;
  return sendToTab(tab.id, message);
}

export async function sendToRuntime(message) {
  try {
    return await ext().runtime.sendMessage(message);
  } catch {
    return undefined;
  }
}

// Registers a { [type]: handler(message, sender) } map. A handler's return value (or the value its
// promise resolves to) is sent back as the response.
export function listen(handlers) {
  const listener = (message, sender, sendResponse) => {
    const handler = message && Object.hasOwn(handlers, message.type) ? handlers[message.type] : null;
    if (!handler) return false;
    Promise.resolve()
      .then(() => handler(message, sender))
      .then(
        (response) => sendResponse(response),
        () => sendResponse(undefined),
      );
    return true;
  };
  ext().runtime.onMessage.addListener(listener);
  return () => ext().runtime.onMessage.removeListener(listener);
}
