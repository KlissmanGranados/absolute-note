(function () {
  const STORAGE_PREFIX = 'absolute_note_';
  const COLORS = [
    { bg: '#fff9c4', border: '#f0e68c', header: '#f5eaa0' },
    { bg: '#bbdefb', border: '#90caf9', header: '#90caf9' },
    { bg: '#c8e6c9', border: '#a5d6a7', header: '#a5d6a7' },
    { bg: '#f8bbd0', border: '#f48fb1', header: '#f48fb1' },
  ];

  let lastClickX = 0;
  let lastClickY = 0;
  let noteContainer = null;

  function getStorageKey() {
    return STORAGE_PREFIX + window.location.href;
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function findScrollContainer(el) {
    while (el) {
      const s = window.getComputedStyle(el);
      if (
        (s.overflowY === 'auto' || s.overflowY === 'scroll' || s.overflow === 'auto' || s.overflow === 'scroll') &&
        el.scrollHeight > el.clientHeight
      ) {
        return el;
      }
      if (el === document.documentElement) break;
      el = el.parentElement;
    }
    return document.scrollingElement || document.documentElement || document.body;
  }

  function scrollOffset(c) {
    if (c === document.documentElement || c === document.body) return { left: 0, top: 0 };
    return { left: c.scrollLeft || 0, top: c.scrollTop || 0 };
  }

  function ensureContainer(refEl) {
    const detected = findScrollContainer(refEl || document.body);
    if (detected !== noteContainer) {
      const oldC = noteContainer;
      noteContainer = detected;
      if (detected !== document.documentElement && detected !== document.body) {
        noteContainer.style.position = 'relative';
      }
      const notesToMove = oldC ? document.querySelectorAll('.absolute-note') : [];
      if (notesToMove.length > 0) {
        const newCRect = noteContainer.getBoundingClientRect();
        const so = scrollOffset(noteContainer);
        getNotes((notes) => {
          notesToMove.forEach((el) => {
            const elRect = el.getBoundingClientRect();
            const centerX = elRect.left + elRect.width / 2;
            const centerY = elRect.top + elRect.height / 2;
            el.style.left = (centerX - newCRect.left + so.left) + 'px';
            el.style.top = (centerY - newCRect.top + so.top) + 'px';
            const noteId = el.getAttribute('data-note-id');
            const note = notes.find((n) => n.id === noteId);
            if (note) {
              note.posX_px = parseFloat(el.style.left);
              note.posY_px = parseFloat(el.style.top);
            }
          });
          saveNotes(notes);
        });
      }
    }
    return noteContainer;
  }

  function loadNotes() {
    const key = getStorageKey();
    try {
      chrome.storage.local.get(key, (result) => {
        try { if (!chrome.runtime?.id) return; } catch(e) { return; }
        if (chrome.runtime.lastError) return;
        const notes = result[key] || [];
        notes.forEach((note) => renderNote(note));
        const refEl = document.elementFromPoint(window.innerWidth / 2, Math.min(300, window.innerHeight / 2));
        ensureContainer(refEl || document.body);
      });
    } catch(e) {}
  }

  function saveNotes(notes) {
    const key = getStorageKey();
    try {
      chrome.storage.local.set({ [key]: notes });
    } catch(e) {}
  }

  function getNotes(callback) {
    const key = getStorageKey();
    try {
      chrome.storage.local.get(key, (result) => {
        try { if (!chrome.runtime?.id) { callback([]); return; } } catch(e) { callback([]); return; }
        if (chrome.runtime.lastError) {
          callback([]);
          return;
        }
        callback(result[key] || []);
      });
    } catch(e) { callback([]); }
  }

  function applyColor(el, note) {
    const c = COLORS[note.colorIndex] || COLORS[0];
    el.style.background = c.bg;
    el.style.borderColor = c.border;
    el.setAttribute('data-color-index', note.colorIndex);
    const h = el.querySelector('.absolute-note-header');
    if (h) h.style.background = c.header;
  }

  function renderNote(note) {
    if (document.getElementById('absolute-note-' + note.id)) return;

    if (note.colorIndex == null) note.colorIndex = 0;
    if (note.posX_px == null) {
      note.posX_px = 0;
      note.posY_px = 0;
    }

    const el = document.createElement('div');
    el.className = 'absolute-note';
    el.id = 'absolute-note-' + note.id;
    el.setAttribute('data-note-id', note.id);
    applyColor(el, note);
    el.style.left = note.posX_px + 'px';
    el.style.top = note.posY_px + 'px';

    const header = document.createElement('div');
    header.className = 'absolute-note-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'absolute-note-header-left';

    const lockBtn = document.createElement('button');
    lockBtn.className = 'absolute-note-lock';
    lockBtn.textContent = note.locked ? '🔒' : '🔓';
    lockBtn.title = note.locked ? getText('unlock') : getText('lock');

    const editBtn = document.createElement('button');
    editBtn.className = 'absolute-note-edit';
    editBtn.textContent = '✏️';
    editBtn.title = getText('edit');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (note.locked) return;
      body.contentEditable = 'true';
      body.focus();
      const range = document.createRange();
      range.selectNodeContents(body);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'absolute-note-delete';
    deleteBtn.textContent = '×';
    deleteBtn.title = getText('delete');

    const colorsWrap = document.createElement('div');
    colorsWrap.className = 'absolute-note-colors';
    COLORS.forEach((c, i) => {
      const dot = document.createElement('span');
      dot.className = 'absolute-note-color-dot' + (i === note.colorIndex ? ' active' : '');
      dot.style.background = c.bg;
      dot.style.borderColor = c.border;
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        note.colorIndex = i;
        applyColor(el, note);
        colorsWrap.querySelectorAll('.absolute-note-color-dot').forEach((d) => d.classList.remove('active'));
        dot.classList.add('active');
        persistNote(note);
      });
      colorsWrap.appendChild(dot);
    });

    const body = document.createElement('div');
    body.className = 'absolute-note-body';
    body.contentEditable = 'false';
    body.textContent = note.text || '';

    let isComposing = false;
    body.addEventListener('compositionstart', () => { isComposing = true; });
    body.addEventListener('compositionend', () => {
      isComposing = false;
      body.dispatchEvent(new Event('input'));
    });
    body.addEventListener('input', () => {
      if (isComposing) return;
      note.text = body.textContent;
      persistNote(note);
      rebuildOutline();
    });

    body.addEventListener('click', (e) => {
      e.stopPropagation();
      if (note.locked) return;
      if (body.contentEditable !== 'true') {
        body.contentEditable = 'true';
        body.focus();
      }
    });

    body.addEventListener('blur', () => {
      if (body.contentEditable === 'true') {
        body.contentEditable = 'false';
        note.text = body.textContent;
        persistNote(note);
        rebuildOutline();
      }
    });

    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      note.locked = !note.locked;
      lockBtn.textContent = note.locked ? '🔒' : '🔓';
      lockBtn.title = note.locked ? getText('unlock') : getText('lock');
      el.classList.toggle('absolute-note--locked', note.locked);
      if (note.locked) {
        body.contentEditable = 'false';
      }
      persistNote(note);
    });

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteNote(note.id);
    });

    headerLeft.appendChild(lockBtn);
    headerLeft.appendChild(editBtn);
    header.appendChild(headerLeft);
    header.appendChild(colorsWrap);
    header.appendChild(deleteBtn);
    el.appendChild(header);
    el.appendChild(body);
    (noteContainer || document.body).appendChild(el);

    if (note.locked) {
      el.classList.add('absolute-note--locked');
      body.contentEditable = 'false';
    }

    makeDraggable(el, note);
  }

  function persistNote(note) {
    getNotes((notes) => {
      const idx = notes.findIndex((n) => n.id === note.id);
      if (idx !== -1) {
        notes[idx] = note;
      } else {
        notes.push(note);
      }
      saveNotes(notes);
    });
  }

  function deleteNote(id) {
    const el = document.getElementById('absolute-note-' + id);
    if (el) el.remove();
    getNotes((notes) => {
      const filtered = notes.filter((n) => n.id !== id);
      saveNotes(filtered);
      rebuildOutline();
    });
  }

  function makeDraggable(el, note) {
    let offsetX = 0, offsetY = 0;
    let dragging = false;
    let dragInit = false;
    let startX = 0, startY = 0;
    let wasEditing = false;
    const DRAG_THRESHOLD = 4;
    const body = el.querySelector('.absolute-note-body');
    const header = el.querySelector('.absolute-note-header');

    let wheelHandler = null;

    function beginDrag(ev) {
      dragging = true;
      wasEditing = body.contentEditable === 'true';
      const rect = el.getBoundingClientRect();
      offsetX = ev.clientX - rect.left;
      offsetY = ev.clientY - rect.top;
      body.contentEditable = 'false';
      const c = noteContainer || document.body;
      c.style.overflow = 'hidden';
    }

    function onStart(e) {
      const ev = e.touches ? e.touches[0] : e;
      if (note.locked) return;
      e.stopPropagation();
      e.preventDefault();
      dragInit = true;
      startX = ev.clientX;
      startY = ev.clientY;
    }

    function onMove(e) {
      if (!dragging && dragInit) {
        e.stopPropagation();
        e.preventDefault();
        const ev = e.touches ? e.touches[0] : e;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
          beginDrag(ev);
        }
        return;
      }
      if (!dragging) return;
      e.stopPropagation();
      e.preventDefault();
      const ev = e.touches ? e.touches[0] : e;
      const c = noteContainer || document.body;
      const cRect = c.getBoundingClientRect();
      const so = scrollOffset(c);
      const pageX = ev.clientX - offsetX - cRect.left + so.left;
      const pageY = ev.clientY - offsetY - cRect.top + so.top;
      el.style.left = pageX + 'px';
      el.style.top = pageY + 'px';
      el.classList.add('absolute-note-dragging');
    }

    function onEnd() {
      if (!dragging) {
        dragInit = false;
        return;
      }
      dragging = false;
      dragInit = false;
      el.classList.remove('absolute-note-dragging');
      const c = noteContainer || document.body;
      c.style.overflow = '';
      if (wasEditing && !note.locked) {
        body.contentEditable = 'true';
      } else {
        body.contentEditable = 'false';
      }
      const cRect = c.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const so = scrollOffset(c);
      note.posX_px = elRect.left - cRect.left + elRect.width / 2 + so.left;
      note.posY_px = elRect.top - cRect.top + elRect.height / 2 + so.top;
      el.style.left = note.posX_px + 'px';
      el.style.top = note.posY_px + 'px';
      persistNote(note);
      rebuildOutline();
    }

    header.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    header.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }

  function createNoteAt(clientX, clientY) {
    ensureContainer(document.elementFromPoint(clientX, clientY));
    const c = noteContainer || document.body;
    const cRect = c.getBoundingClientRect();
    const so = scrollOffset(c);
    const pageX = clientX - cRect.left + so.left;
    const pageY = clientY - cRect.top + so.top;

    const note = {
      id: generateId(),
      text: '',
      locked: false,
      colorIndex: 0,
      posX_px: pageX,
      posY_px: pageY,
    };

    renderNote(note);
    persistNote(note);

    const el = document.getElementById('absolute-note-' + note.id);
    if (el) {
      const body = el.querySelector('.absolute-note-body');
      if (body) {
        body.contentEditable = 'true';
        requestAnimationFrame(() => {
          body.focus();
          const range = document.createRange();
          range.selectNodeContents(body);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        });
      }
    }

    rebuildOutline();
  }

  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.absolute-note')) return;
    lastClickX = e.clientX;
    lastClickY = e.clientY;
  });

  function exportNotes() {
    try {
      chrome.storage.local.get(null, (data) => {
        try { if (!chrome.runtime?.id) return; } catch(e) { return; }
        if (chrome.runtime.lastError) return;
        const prefix = STORAGE_PREFIX;
        const filtered = {};
        for (const key in data) {
          if (key.startsWith(prefix)) {
            filtered[key] = data[key];
          }
        }
        const count = Object.values(filtered).reduce((sum, arr) => sum + arr.length, 0);
        if (count === 0) {
          alert(getText('no_notes_export'));
          return;
        }
        const json = JSON.stringify(filtered, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'absolute-notes-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch(e) {
      console.error('Error exporting notes:', e);
    }
  }

  function importNotes() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        try {
          const imported = JSON.parse(reader.result);
          const prefix = STORAGE_PREFIX;
          const merged = {};
          chrome.storage.local.get(null, (existing) => {
            try { if (!chrome.runtime?.id) return; } catch(e) { return; }
            if (chrome.runtime.lastError) return;
            for (const key in existing) {
              if (key.startsWith(prefix)) {
                merged[key] = existing[key];
              }
            }
            for (const key in imported) {
              if (!key.startsWith(prefix)) continue;
              if (!merged[key]) {
                merged[key] = imported[key];
              } else {
                const existingIds = new Set(merged[key].map((n) => n.id));
                for (const note of imported[key]) {
                  if (!existingIds.has(note.id)) {
                    merged[key].push(note);
                  }
                }
              }
            }
            chrome.storage.local.set(merged, () => {
              if (chrome.runtime.lastError) return;
              const notes = merged[STORAGE_PREFIX + window.location.href] || [];
              document.querySelectorAll('.absolute-note').forEach((el) => el.remove());
              const refEl = document.elementFromPoint(window.innerWidth / 2, Math.min(300, window.innerHeight / 2));
              ensureContainer(refEl || document.body);
              notes.forEach((note) => renderNote(note));
              rebuildOutline();
              alert(getText('import_ok'));
            });
          });
        } catch {
          alert(getText('import_invalid'));
        }
      });
      reader.readAsText(file);
    });
    input.click();
  }

  let outlinePanel = null;

  function rebuildOutline() {
    if (!outlinePanel || outlinePanel.style.display === 'none') return;
    const list = outlinePanel.querySelector('.absolute-note-outline-list');
    const headerTitle = outlinePanel.querySelector('.absolute-note-outline-header span');
    const allNotes = [];
    document.querySelectorAll('.absolute-note').forEach((el) => {
      const id = el.getAttribute('data-note-id');
      const body = el.querySelector('.absolute-note-body');
      const raw = body ? body.textContent.trim() || getText('outline_empty') : getText('outline_empty');
      const text = raw.length > 50 ? raw.slice(0, 50) + '...' : raw;
      const top = parseFloat(el.style.top) || 0;
      allNotes.push({ id, text, top, el });
    });
    allNotes.sort((a, b) => a.top - b.top);
    list.innerHTML = '';
    allNotes.forEach((n, i) => {
      const item = document.createElement('div');
      item.className = 'absolute-note-outline-item';
      const dot = document.createElement('span');
      dot.className = 'absolute-note-outline-dot';
      const ci = parseInt(n.el.getAttribute('data-color-index'));
      const c = COLORS[isNaN(ci) ? 0 : ci];
      dot.style.background = c.bg;
      dot.style.borderColor = c.border;
      const label = document.createElement('span');
      label.className = 'absolute-note-outline-label';
      label.textContent = '#' + (i + 1) + ' ' + n.text;
      item.appendChild(dot);
      item.appendChild(label);
      const delBtn = document.createElement('span');
      delBtn.className = 'absolute-note-outline-del';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNote(n.id);
        rebuildOutline();
      });
      item.appendChild(delBtn);
      item.addEventListener('click', (e) => {
        const el = document.getElementById('absolute-note-' + n.id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.boxShadow = '0 0 0 3px #1565c0, 2px 4px 12px rgba(0,0,0,0.25)';
          setTimeout(() => {
            el.style.boxShadow = '';
          }, 2000);
          const body = el.querySelector('.absolute-note-body');
          if (body && !body.closest('.absolute-note--locked')) {
            body.contentEditable = 'true';
            body.focus();
            const range = document.createRange();
            range.selectNodeContents(body);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      });
      list.appendChild(item);
    });
    if (headerTitle) {
      headerTitle.textContent = getText('outline_title_count', { count: allNotes.length });
    }
  }

  function showOutline() {
    if (!outlinePanel) {
      toggleOutline();
    } else if (outlinePanel.style.display === 'none') {
      outlinePanel.style.display = '';
      rebuildOutline();
    }
    saveOutlineState('visible');
  }

  function toggleOutline() {
    if (outlinePanel) {
      if (outlinePanel.style.display === 'none') {
        outlinePanel.style.display = '';
        rebuildOutline();
      } else {
        outlinePanel.style.display = 'none';
        saveOutlineState('hidden');
      }
      return;
    }

    outlinePanel = document.createElement('div');
    outlinePanel.className = 'absolute-note-outline';

    const header = document.createElement('div');
    header.className = 'absolute-note-outline-header';

    const title = document.createElement('span');
    title.textContent = getText('outline_title');

    const closeBtn = document.createElement('button');
    closeBtn.className = 'absolute-note-outline-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => {
      outlinePanel.style.display = 'none';
      saveOutlineState('hidden');
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    const list = document.createElement('div');
    list.className = 'absolute-note-outline-list';

    outlinePanel.appendChild(header);
    outlinePanel.appendChild(list);
    document.body.appendChild(outlinePanel);

    rebuildOutline();
    saveOutlineState('visible');
  }

  function saveOutlineState(state) {
    try {
      chrome.storage.local.set({
        ['absolute_note_outline_' + window.location.href]: state,
      });
    } catch(e) {}
  }

  function restoreOutlineState() {
    try {
      chrome.storage.local.get('absolute_note_outline_' + window.location.href, (result) => {
        try { if (!chrome.runtime?.id) return; } catch(e) { return; }
        if (chrome.runtime.lastError) return;
        if (result['absolute_note_outline_' + window.location.href] === 'visible') {
          showOutline();
        }
      });
    } catch(e) {}
  }

  let lastUrl = window.location.href;
  let pollTimer = null;
  let settleTimer = null;
  let settleObserver = null;

  function cancelSettleWatch() {
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
    if (settleObserver) { settleObserver.disconnect(); settleObserver = null; }
  }

  function handleUrlChange() {
    const currentUrl = window.location.href;
    if (currentUrl === lastUrl) return;
    lastUrl = currentUrl;
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    cancelSettleWatch();
    document.querySelectorAll('.absolute-note').forEach((el) => el.remove());
    if (outlinePanel) outlinePanel.style.display = 'none';
    noteContainer = null;

    settleObserver = new MutationObserver(() => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(onDomSettled, 600);
    });
    settleObserver.observe(document.body, { childList: true, subtree: true });
    settleTimer = setTimeout(onDomSettled, 3000);
  }

  function onDomSettled() {
    cancelSettleWatch();
    tryDetectAndLoad(0);
  }

  window.addEventListener('popstate', handleUrlChange);
  window.addEventListener('hashchange', handleUrlChange);
  setInterval(() => {
    const cur = window.location.href;
    if (cur !== lastUrl) handleUrlChange();
  }, 500);

  function init() {
    chrome.storage.local.get('absolute_note_lang', (result) => {
      if (result.absolute_note_lang) setLang(result.absolute_note_lang);
      tryDetectAndLoad(0);
    });
  }

  function tryDetectAndLoad(attempts) {
    if (window.location.href !== lastUrl) return;
    const refEl = document.elementFromPoint(window.innerWidth / 2, Math.min(300, window.innerHeight / 2));
    const detected = findScrollContainer(refEl || document.body);
    const isDefault = detected === document.body || detected === document.documentElement;

    if (!isDefault || attempts >= 10) {
      ensureContainer(refEl || document.body);
      loadNotes();
      restoreOutlineState();
    } else {
      pollTimer = setTimeout(() => tryDetectAndLoad(attempts + 1), 500);
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'createNote') {
      createNoteAt(lastClickX, lastClickY);
    } else if (msg.action === 'exportNotes') {
      exportNotes();
    } else if (msg.action === 'importNotes') {
      importNotes();
    } else if (msg.action === 'openOutline') {
      showOutline();
    } else if (msg.action === 'toggleOutline') {
      toggleOutline();
    } else if (msg.action === 'setLang') {
      setLang(msg.lang);
      document.querySelectorAll('.absolute-note').forEach((el) => {
        const locked = el.classList.contains('absolute-note--locked');
        const lockBtn = el.querySelector('.absolute-note-lock');
        if (lockBtn) lockBtn.title = locked ? getText('unlock') : getText('lock');
        const editBtn = el.querySelector('.absolute-note-edit');
        if (editBtn) editBtn.title = getText('edit');
        const deleteBtn = el.querySelector('.absolute-note-delete');
        if (deleteBtn) deleteBtn.title = getText('delete');
      });
      if (outlinePanel) {
        const title = outlinePanel.querySelector('.absolute-note-outline-header span');
        if (title) title.textContent = getText('outline_title');
        rebuildOutline();
      }
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
