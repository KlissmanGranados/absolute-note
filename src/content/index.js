import { isContextAlive } from '../shared/ext.js';
import { setLang } from '../shared/i18n.js';
import { MSG, NOTE_CMD, listen, sendToRuntime } from '../shared/messages.js';
import * as store from '../shared/store.js';
import { watchTheme } from '../shared/theme.js';
import { normalizePageUrl } from '../shared/url.js';
import { pageElementAt } from './container.js';
import { NotesController } from './controller.js';
import outlinePanelCss from './css/outline-panel.css';
import { OutlinePanel } from './outline-panel.js';
import { attachStyledShadow } from './shadow.js';

const IS_TOP_FRAME = window.top === window.self;
const URL_POLL_MS = 500;
const SETTLE_QUIET_MS = 600;
const INITIAL_SETTLE_MAX_MS = 2000;
const NAVIGATION_SETTLE_MAX_MS = 3000;
const CONTAINER_CHECK_MS = 400;
const HIDDEN_CLASS = 'absolute-note-notes-hidden';
const HOST_ID = 'absolute-note-host';

// Resolves once the DOM has been quiet for a moment (SPAs keep rendering after load), or after maxWait.
function waitForDomSettle(maxWait) {
  return new Promise((resolve) => {
    const done = () => {
      observer.disconnect();
      clearTimeout(quietTimer);
      clearTimeout(maxTimer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(done, SETTLE_QUIET_MS);
    });
    let quietTimer = setTimeout(done, SETTLE_QUIET_MS);
    const maxTimer = setTimeout(done, maxWait);
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  });
}

// Wires one page (or frame) to the extension: which page's notes are shown, navigation, the outline
// panel, hide/show and the messages from the popup and the outline window.
class ContentApp {
  constructor() {
    this.pageUrl = normalizePageUrl(location.href);
    this.controller = null;
    this.outline = null;
    this.host = null;
    this.hostRoot = null;
    this.theme = 'light';
    // Notes found in storage for the page, before they are rendered (rendering waits for the DOM).
    this.storedNoteCount = 0;
    this.generation = 0;
    this.pollTimer = null;
    this.containerObserver = null;
    this.containerTimer = null;
  }

  async start() {
    // Leftovers from a previous instance of the extension (reloaded or updated).
    document.querySelectorAll('.absolute-note, #' + HOST_ID).forEach((el) => el.remove());

    const lang = await store.loadLang();
    if (lang) setLang(lang);
    watchTheme((theme) => this.setTheme(theme));
    store.onLangChanged((next) => {
      setLang(next);
      this.applyLang();
    });

    window.addEventListener('popstate', () => this.syncUrl());
    window.addEventListener('hashchange', () => this.syncUrl());
    if (IS_TOP_FRAME) {
      listen(this.messageHandlers());
      // pushState can't be observed from a content script; poll for it.
      this.startUrlPolling();
    }
    await this.openPage({ initial: true });
  }

  async openPage({ initial }) {
    const generation = ++this.generation;
    const pageUrl = this.pageUrl;
    const controller = new NotesController(pageUrl, { onChange: () => this.onNotesChanged() });
    this.controller = controller;

    const [notes, ui] = await Promise.all([store.loadNotes(pageUrl), store.loadPageUiState(pageUrl)]);
    if (generation !== this.generation) return;
    this.storedNoteCount = notes.length;
    document.documentElement.classList.toggle(HIDDEN_CLASS, ui.notesHidden);
    // Pages without notes stay idle: no rendering, no DOM observers.
    if (!notes.length && !ui.outlineVisible) return;

    if (initial) {
      await waitForDomSettle(INITIAL_SETTLE_MAX_MS);
      if (generation !== this.generation) return;
    }
    controller.ensureContainer(pageElementAt(window.innerWidth / 2, window.innerHeight / 2));
    await controller.load();
    if (generation !== this.generation) return;
    this.storedNoteCount = 0;
    if (ui.outlineVisible) this.showOutline({ persist: false });

    if (!initial) {
      await waitForDomSettle(NAVIGATION_SETTLE_MAX_MS);
      if (generation === this.generation) controller.checkContainer();
    }
  }

  syncUrl() {
    if (!isContextAlive()) {
      this.shutdown();
      return;
    }
    const next = normalizePageUrl(location.href);
    if (next === this.pageUrl) return;
    this.pageUrl = next;
    this.storedNoteCount = 0;
    if (this.controller) this.controller.destroy();
    this.controller = null;
    if (this.outline) this.outline.destroy();
    this.outline = null;
    this.updateActivity();
    if (IS_TOP_FRAME) sendToRuntime({ type: MSG.PAGE_URL_CHANGED, pageUrl: next });
    this.openPage({ initial: false }).catch(() => {});
  }

  startUrlPolling() {
    if (!this.pollTimer) this.pollTimer = setInterval(() => this.syncUrl(), URL_POLL_MS);
  }

  stopUrlPolling() {
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  onNotesChanged() {
    if (this.outline) this.outline.render(this.controller.list());
    this.updateActivity();
  }

  // DOM observation (and URL polling in subframes) only runs while the page shows notes or the outline.
  updateActivity() {
    const active = !!this.controller && (this.controller.size > 0 || (!!this.outline && this.outline.visible));
    if (active && !this.containerObserver) {
      this.containerObserver = new MutationObserver(() => {
        clearTimeout(this.containerTimer);
        this.containerTimer = setTimeout(() => {
          if (this.controller) this.controller.checkContainer();
        }, CONTAINER_CHECK_MS);
      });
      this.containerObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
    } else if (!active && this.containerObserver) {
      this.containerObserver.disconnect();
      this.containerObserver = null;
      clearTimeout(this.containerTimer);
    }
    if (!IS_TOP_FRAME) {
      if (active) this.startUrlPolling();
      else this.stopUrlPolling();
    }
  }

  // The extension was reloaded or updated: this instance can no longer reach storage.
  shutdown() {
    this.stopUrlPolling();
    if (this.containerObserver) this.containerObserver.disconnect();
    this.containerObserver = null;
    if (this.controller) this.controller.destroy({ commit: false });
    this.controller = null;
    if (this.host) this.host.remove();
    this.outline = null;
  }

  isHidden() {
    return document.documentElement.classList.contains(HIDDEN_CLASS);
  }

  setHidden(hidden) {
    document.documentElement.classList.toggle(HIDDEN_CLASS, hidden);
    store.setNotesHidden(this.pageUrl, hidden).catch(() => {});
    return hidden;
  }

  createAtCenter() {
    if (!this.controller) return;
    if (this.isHidden()) this.setHidden(false);
    this.controller.createAt(window.innerWidth / 2, window.innerHeight / 2).catch(() => {});
  }

  // Applied to the host element (which the outline panel's stylesheet reads) once it exists.
  setTheme(theme) {
    this.theme = theme;
    if (this.host) this.host.setAttribute('data-theme', theme);
  }

  // Fixed, full-viewport layer for the extension's own UI (the outline panel), isolated from the
  // page's CSS in a shadow root.
  ensureHostRoot() {
    if (this.host && this.host.isConnected) return this.hostRoot;
    this.host = document.createElement('div');
    this.host.id = HOST_ID;
    this.host.className = 'absolute-note-host';
    this.hostRoot = attachStyledShadow(this.host, outlinePanelCss);
    this.host.setAttribute('data-theme', this.theme);
    document.documentElement.appendChild(this.host);
    return this.hostRoot;
  }

  showOutline({ persist = true } = {}) {
    if (!this.controller) return;
    if (!this.outline || !this.outline.panel.isConnected) {
      this.outline = new OutlinePanel(this.ensureHostRoot(), {
        onCreate: () => this.createAtCenter(),
        onEject: () => this.ejectOutline(),
        onClose: () => this.hideOutline(),
        listHandlers: {
          onSelect: (id) => this.controller && this.controller.scrollTo(id),
          onToggleLock: (id) => this.controller && this.controller.toggleLock(id),
          onEdit: (id) => this.controller && this.controller.edit(id),
          onDelete: (id) => this.controller && this.controller.remove(id),
        },
      });
    }
    this.outline.show();
    this.outline.render(this.controller.list());
    if (persist) store.setOutlineVisible(this.pageUrl, true).catch(() => {});
    this.updateActivity();
  }

  hideOutline() {
    if (this.outline) this.outline.hide();
    store.setOutlineVisible(this.pageUrl, false).catch(() => {});
    this.updateActivity();
  }

  ejectOutline() {
    sendToRuntime({ type: MSG.OPEN_OUTLINE_WINDOW, pageUrl: this.pageUrl });
    this.hideOutline();
  }

  applyLang() {
    if (this.controller) this.controller.applyLang();
    if (this.outline) this.outline.applyLang();
  }

  runNoteCommand({ cmd, id, pageUrl }) {
    const controller = this.controller;
    // The outline window may still be showing the page this tab was on before navigating.
    if (!controller || (pageUrl && pageUrl !== this.pageUrl)) return { ok: false };
    switch (cmd) {
      case NOTE_CMD.ADD:
        this.createAtCenter();
        return { ok: true };
      case NOTE_CMD.SCROLL_TO:
        return { ok: controller.scrollTo(id) };
      case NOTE_CMD.EDIT:
        return { ok: controller.edit(id) };
      case NOTE_CMD.DELETE:
        return { ok: controller.remove(id) };
      case NOTE_CMD.TOGGLE_LOCK:
        return { ok: controller.toggleLock(id) };
      default:
        return { ok: false };
    }
  }

  messageHandlers() {
    // Each command first catches up with SPA navigation the poll hasn't seen yet.
    return {
      [MSG.CREATE_NOTE]: () => {
        this.syncUrl();
        this.createAtCenter();
        return { ok: true };
      },
      [MSG.GET_PAGE_STATE]: () => {
        this.syncUrl();
        const rendered = this.controller ? this.controller.size : 0;
        return { hasNotes: rendered > 0 || this.storedNoteCount > 0, hidden: this.isHidden() };
      },
      [MSG.OPEN_OUTLINE]: () => {
        this.syncUrl();
        this.showOutline();
        return { ok: true };
      },
      [MSG.TOGGLE_HIDE_NOTES]: () => {
        this.syncUrl();
        return { hidden: this.setHidden(!this.isHidden()) };
      },
      [MSG.NOTE_COMMAND]: (message) => {
        this.syncUrl();
        return this.runNoteCommand(message);
      },
    };
  }
}

new ContentApp().start().catch(() => {});
