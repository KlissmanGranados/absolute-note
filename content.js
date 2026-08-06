(function () {
  const STORAGE_PREFIX = 'absolute_note_';
  const SETTINGS_KEY = 'absolute_note_settings';
  const DEFAULT_SETTINGS = { width: 170, height: 325, fontSize: 14 };
  const COLORS = [
    { bg: '#fff9c4', border: '#f0e68c', header: '#f5eaa0' },
    { bg: '#bbdefb', border: '#90caf9', header: '#90caf9' },
    { bg: '#c8e6c9', border: '#a5d6a7', header: '#a5d6a7' },
    { bg: '#f8bbd0', border: '#f48fb1', header: '#f48fb1' },
  ];

  let noteContainer = null;
  let host = null;
  let migrating = false;
  let readerMode = false;
  let editingNoteId = null;
  let inlineSavedRange = null;
  const noteCleanups = new Map();
  const notesById = new Map();
  const noteKeys = new Map();

  let suppressClickAfterGesture = false;
  let lastDragEndTime = 0;
  const SUPPRESS_CLICK_WINDOW_MS = 400;
  function onDocumentClickCapture(e) {
    if (!suppressClickAfterGesture) return;
    const insideNote = e.target instanceof Element && e.target.closest('.absolute-note');
    const recent = Date.now() - lastDragEndTime <= SUPPRESS_CLICK_WINDOW_MS;
    if (!insideNote && !recent) return;
    suppressClickAfterGesture = false;
    e.stopPropagation();
    if (insideNote) e.preventDefault();
  }
  document.addEventListener('click', onDocumentClickCapture, true);

  function getStorageKey() {
    return STORAGE_PREFIX + window.location.href;
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function clampNum(v, min, max, def) {
    const n = parseInt(v, 10);
    if (isNaN(n)) return def;
    return Math.min(max, Math.max(min, n));
  }

  function ensureHost() {
    if (host && host.isConnected) return host;
    host = document.getElementById('absolute-note-host');
    if (!host || !host.isConnected) {
      host = document.createElement('div');
      host.id = 'absolute-note-host';
      host.className = 'absolute-note-host';
      (document.documentElement || document.body).appendChild(host);
    }
    return host;
  }

  function isDefaultContainer(el) {
    return !el || el === document.documentElement || el === document.body;
  }

  function isScrollableStyle(s) {
    return (
      s.overflowY === 'auto' || s.overflowY === 'scroll' || s.overflowY === 'overlay' ||
      s.overflow === 'auto' || s.overflow === 'scroll' || s.overflow === 'overlay'
    );
  }

  function findScrollContainer(el) {
    let candidate = null;
    let best = null;
    let bestSurface = -1;
    while (el) {
      const s = window.getComputedStyle(el);
      if (isScrollableStyle(s)) {
        const surface = (el.scrollHeight - el.clientHeight) + (el.scrollWidth - el.clientWidth);
        if (!candidate) candidate = el;
        if (best === null || surface > bestSurface) {
          best = el;
          bestSurface = surface;
        }
      }
      if (el === document.documentElement) break;
      el = el.parentElement;
    }
    if (best && bestSurface > 0) {
      return best;
    }
    if (candidate) return candidate;
    return document.scrollingElement || document.documentElement || document.body;
  }

  function scrollOffset(c) {
    if (c === document.documentElement || c === document.body) {
      const se = document.scrollingElement || document.documentElement;
      return { borderL: 0, borderT: 0, left: se ? se.scrollLeft || 0 : 0, top: se ? se.scrollTop || 0 : 0 };
    }
    const cs = window.getComputedStyle(c);
    return {
      borderL: parseFloat(cs.borderLeftWidth) || 0,
      borderT: parseFloat(cs.borderTopWidth) || 0,
      left: c.scrollLeft || 0,
      top: c.scrollTop || 0,
    };
  }

  function isReaderLikeContainer(c) {
    if (isDefaultContainer(c)) return false;
    const r = c.getBoundingClientRect();
    return r.height >= window.innerHeight * 0.9;
  }

  function applyScrollMode(c) {
    readerMode = c ? isReaderLikeContainer(c) : false;
    document.querySelectorAll('.absolute-note').forEach((el) => {
      el.classList.toggle('absolute-note--reader', readerMode);
    });
    return readerMode;
  }

  function ensureContainer(refEl) {
    const detected = findScrollContainer(refEl || document.body);
    const currentValid = noteContainer && noteContainer.isConnected;

    if (currentValid) {
      if (!isDefaultContainer(noteContainer)) {
        applyScrollMode(noteContainer);
        return noteContainer;
      }
      if (isDefaultContainer(detected)) {
        applyScrollMode(noteContainer);
        return noteContainer;
      }
    }

    if (migrating) return noteContainer || detected;

    migrating = true;
    const oldC = noteContainer;
    noteContainer = detected;
    if (!isDefaultContainer(detected)) {
      noteContainer.style.position = 'relative';
    }
    applyScrollMode(noteContainer);

    const notesToMove = oldC ? document.querySelectorAll('.absolute-note') : [];
    if (notesToMove.length > 0) {
      const migrationKey = getStorageKey();
      getNotes((notes) => {
        if (getStorageKey() !== migrationKey) { migrating = false; return; }
        const newCRect = noteContainer.getBoundingClientRect();
        const so = scrollOffset(noteContainer);
        notesToMove.forEach((el) => {
          if (noteContainer.contains(el)) return;
          const elRect = el.getBoundingClientRect();
          const centerX = elRect.left + elRect.width / 2;
          el.style.left = (centerX - newCRect.left - so.borderL + so.left) + 'px';
          el.style.top = (elRect.top - newCRect.top - so.borderT + so.top) + 'px';
          noteContainer.appendChild(el);
          const noteId = el.getAttribute('data-note-id');
          const note = notes.find((n) => n.id === noteId);
          if (note) {
            note.posX_px = parseFloat(el.style.left);
            note.posY_px = parseFloat(el.style.top);
            note.anchor = note.anchor || 'top';
          }
        });
        saveNotes(notes, migrationKey);
        migrating = false;
      });
    } else {
      migrating = false;
    }
    return noteContainer;
  }

  function loadNotes(key) {
    if (key == null) key = getStorageKey();
    try {
      chrome.storage.local.get(key, (result) => {
        try { if (!chrome.runtime?.id) return; } catch (e) { return; }
        if (chrome.runtime.lastError) return;
        if (key !== getStorageKey()) return;
        const notes = result[key] || [];
        notes.filter((note) => !note.key || note.key === key).forEach((note) => {
          if (!note.key) {
            note.key = key;
            persistNote(note);
          }
          renderNote(note, key);
        });
      });
    } catch (e) {}
  }

  function saveNotes(notes, key) {
    if (key == null) key = getStorageKey();
    try {
      chrome.storage.local.set({ [key]: notes });
    } catch (e) {}
  }

  function getNotes(callback, key) {
    if (key == null) key = getStorageKey();
    try {
      chrome.storage.local.get(key, (result) => {
        try { if (!chrome.runtime?.id) { callback([]); return; } } catch (e) { callback([]); return; }
        if (chrome.runtime.lastError) {
          callback([]);
          return;
        }
        callback(result[key] || []);
      });
    } catch (e) { callback([]); }
  }

  function applyColor(el, note) {
    const c = COLORS[note.colorIndex] || COLORS[0];
    el.style.background = c.bg;
    el.style.borderColor = c.border;
    el.setAttribute('data-color-index', note.colorIndex);
    const h = el.querySelector('.absolute-note-header');
    if (h) h.style.background = c.header;
  }

  function renderNote(note, key) {
    if (document.getElementById('absolute-note-' + note.id)) return;

    if (note.colorIndex == null) note.colorIndex = 0;
    if (note.posX_px == null) note.posX_px = 0;
    if (note.posY_px == null) note.posY_px = 0;

    if (note.anchor !== 'top') {
      const migH = clampNum(note.h_px, 80, 2000, DEFAULT_SETTINGS.height);
      note.posY_px -= migH / 2;
      note.anchor = 'top';
      persistNote(note);
    }

    if (key != null) {
      note.key = key;
      noteKeys.set(note.id, key);
    }

    const el = document.createElement('div');
    el.className = 'absolute-note';
    el.id = 'absolute-note-' + note.id;
    el.setAttribute('data-note-id', note.id);
    applyColor(el, note);
    el.style.left = note.posX_px + 'px';
    el.style.top = note.posY_px + 'px';
    if (note.w_px != null) el.style.width = note.w_px + 'px';
    if (note.h_px != null) el.style.minHeight = note.h_px + 'px';
    if (note.fontSize) el.style.fontSize = note.fontSize + 'px';

    const header = document.createElement('div');
    header.className = 'absolute-note-header';

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
    body.setAttribute('data-placeholder', getText('outline_empty'));
    body.innerHTML = sanitizeHtml(note.text || '');

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteNote(note.id);
    });

    header.appendChild(colorsWrap);
    header.appendChild(deleteBtn);
    el.appendChild(header);
    el.appendChild(body);
    (noteContainer || document.body).appendChild(el);

    if (note.locked) {
      el.classList.add('absolute-note--locked');
    }
    if (readerMode) {
      el.classList.add('absolute-note--reader');
    }

    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (note.locked) return;
      if (e.target instanceof Element && e.target.closest('button, .absolute-note-color-dot, .absolute-note-resize, select, input, a')) return;
      startInlineEdit(note, el);
    });

    notesById.set(note.id, note);
    const dragCleanup = makeDraggable(el, note);
    const resizeCleanup = setupResizeObserver(el, note);
    const gripCleanup = setupResizeGrip(el, note);
    noteCleanups.set(note.id, () => {
      if (dragCleanup) dragCleanup();
      if (resizeCleanup) resizeCleanup();
      if (gripCleanup) gripCleanup();
    });
  }

  function persistNote(note) {
    const key = note.key || getStorageKey();
    if (note.key && note.key !== getStorageKey()) return;
    note.key = key;
    noteKeys.set(note.id, key);
    getNotes((notes) => {
      const idx = notes.findIndex((n) => n.id === note.id);
      if (idx !== -1) {
        notes[idx] = note;
      } else {
        notes.push(note);
      }
      saveNotes(notes, key);
    }, key);
  }

  function deleteNote(id) {
    const note = notesById.get(id) || { id };
    const clean = noteCleanups.get(id);
    if (clean) { clean(); noteCleanups.delete(id); }
    if (editingNoteId === id) editingNoteId = null;
    notesById.delete(id);
    const el = document.getElementById('absolute-note-' + id);
    if (el) el.remove();
    const key = note.key || noteKeys.get(id) || getStorageKey();
    if (note.key && note.key !== getStorageKey()) return;
    getNotes((notes) => {
      const filtered = notes.filter((n) => n.id !== id);
      saveNotes(filtered, key);
      rebuildOutline();
    }, key);
  }

  function scrollToNoteById(id) {
    const el = document.getElementById('absolute-note-' + id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.boxShadow = '0 0 0 3px #1565c0, 2px 4px 12px rgba(0,0,0,0.25)';
    setTimeout(() => {
      el.style.boxShadow = '';
    }, 2000);
  }

  function editNoteById(id) {
    const note = notesById.get(id);
    const el = document.getElementById('absolute-note-' + id);
    if (note && el && !note.locked) {
      startInlineEdit(note, el);
    }
  }

  function toggleLockById(id) {
    const note = notesById.get(id);
    if (!note) return;
    note.locked = !note.locked;
    const el = document.getElementById('absolute-note-' + id);
    if (el) el.classList.toggle('absolute-note--locked', note.locked);
    persistNote(note);
    rebuildOutline();
  }

  function openOutlineWindow() {
    try {
      chrome.runtime.sendMessage({ action: 'openOutlineWindow' }, () => { void chrome.runtime.lastError; });
    } catch (e) {}
    if (outlinePanel) {
      outlinePanel.style.display = 'none';
      saveOutlineState('hidden');
    }
  }

  function startInlineEdit(note, el) {
    if (note.locked) return;
    if (editingNoteId === note.id) return;
    if (editingNoteId != null) finishInlineEdit();
    const body = el.querySelector('.absolute-note-body');
    if (!body) return;
    editingNoteId = note.id;
    inlineSavedRange = null;
    body.contentEditable = 'true';
    body.classList.add('absolute-note-body--editing');
    el.addEventListener('focusout', onInlineFocusOut);
    buildInlineToolbar(note, el);
    requestAnimationFrame(() => {
      body.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(body);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    });
  }

  function onInlineFocusOut(e) {
    const el = document.getElementById('absolute-note-' + editingNoteId);
    if (el && e.relatedTarget instanceof Element && el.contains(e.relatedTarget)) {
      const sel = window.getSelection();
      if (sel.rangeCount > 0) inlineSavedRange = sel.getRangeAt(0).cloneRange();
      return;
    }
    finishInlineEdit();
  }

  function finishInlineEdit() {
    const id = editingNoteId;
    if (!id) return;
    editingNoteId = null;
    const el = document.getElementById('absolute-note-' + id);
    if (el) {
      el.removeEventListener('focusout', onInlineFocusOut);
      const body = el.querySelector('.absolute-note-body');
      if (body) {
        body.contentEditable = 'false';
        body.classList.remove('absolute-note-body--editing');
      }
      const bar = el.querySelector('.absolute-note-inline-toolbar');
      if (bar) bar.remove();
    }
    const note = notesById.get(id);
    if (note) {
      note.text = el ? sanitizeHtml(el.querySelector('.absolute-note-body').innerHTML) : note.text;
      persistNote(note);
    }
    rebuildOutline();
  }

  function buildInlineToolbar(note, el) {
    const bar = document.createElement('div');
    bar.className = 'absolute-note-inline-toolbar';
    bar.appendChild(inlineToolbarBtn('B', 'bold', null, getText('bold')));
    bar.appendChild(inlineToolbarBtn('I', 'italic', null, getText('italic')));
    bar.appendChild(inlineToolbarBtn('U', 'underline', null, getText('underline')));

    const size = document.createElement('select');
    size.className = 'absolute-note-inline-size';
    size.title = getText('font_size');
    [12, 14, 16, 18, 24, 32].forEach((px) => {
      const opt = document.createElement('option');
      opt.value = px;
      opt.textContent = px + 'px';
      size.appendChild(opt);
    });
    const fs = note.fontSize || 14;
    const has = Array.prototype.some.call(size.options, (o) => o.value === String(fs));
    if (!has) {
      const opt = document.createElement('option');
      opt.value = fs;
      opt.textContent = fs + 'px';
      size.appendChild(opt);
    }
    size.value = String(fs);
    size.addEventListener('change', () => {
      const val = parseInt(size.value, 10);
      if (isNaN(val)) return;
      const editingEl = document.getElementById('absolute-note-' + editingNoteId);
      if (!editingEl) return;
      const body = editingEl.querySelector('.absolute-note-body');
      if (!body) return;
      body.focus();
      const sel = window.getSelection();
      if (inlineSavedRange) {
        sel.removeAllRanges();
        sel.addRange(inlineSavedRange);
      }
      applyInlineFontSize(Math.min(72, Math.max(8, val)));
    });
    bar.appendChild(size);

    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'absolute-note-inline-done';
    done.textContent = '✓';
    done.title = getText('save');
    done.addEventListener('mousedown', (e) => e.preventDefault());
    done.addEventListener('click', finishInlineEdit);
    bar.appendChild(done);

    el.appendChild(bar);
  }

  function inlineToolbarBtn(label, cmd, value, title) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'absolute-note-inline-btn';
    b.textContent = label;
    b.title = title || '';
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => {
      const editingEl = document.getElementById('absolute-note-' + editingNoteId);
      if (!editingEl) return;
      const body = editingEl.querySelector('.absolute-note-body');
      if (body) body.focus();
      document.execCommand(cmd, false, value);
    });
    return b;
  }

  function applyInlineFontSize(px) {
    const editingEl = document.getElementById('absolute-note-' + editingNoteId);
    if (!editingEl) return;
    const body = editingEl.querySelector('.absolute-note-body');
    if (!body) return;
    body.focus();
    document.execCommand('fontSize', false, '7');
    body.querySelectorAll('font').forEach((f) => {
      const span = document.createElement('span');
      span.style.fontSize = px + 'px';
      while (f.firstChild) span.appendChild(f.firstChild);
      f.parentNode.replaceChild(span, f);
    });
  }


  function makeDraggable(el, note) {
    let offsetX = 0, offsetY = 0;
    let dragging = false;
    let dragInit = false;
    let startX = 0, startY = 0;
    const DRAG_THRESHOLD = 4;

    function beginDrag(ev) {
      dragging = true;
      const rect = el.getBoundingClientRect();
      offsetX = ev.clientX - rect.left;
      offsetY = ev.clientY - rect.top;
    }

    function onStart(e) {
      const ev = e.touches ? e.touches[0] : e;
      if (editingNoteId === note.id && e.target instanceof Element && e.target.closest('.absolute-note-body')) {
        e.stopPropagation();
        return;
      }
      if (e.target instanceof Element && e.target.closest('select, input')) {
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      if (note.locked) return;
      if (e.target instanceof Element && e.target.closest('.absolute-note-resize, button, a, .absolute-note-color-dot')) return;
      dragInit = true;
      startX = ev.clientX;
      startY = ev.clientY;
    }

    function captureHeaderStop(e) {
      if (e.target instanceof Element && e.target.closest('.absolute-note-header')) {
        e.stopPropagation();
      }
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
      const pageX = ev.clientX - offsetX - cRect.left - so.borderL + so.left;
      const pageY = ev.clientY - offsetY - cRect.top - so.borderT + so.top;
      el.style.left = pageX + 'px';
      el.style.top = pageY + 'px';
      el.classList.add('absolute-note-dragging');
    }

    function onEnd(e) {
      if (!dragging) {
        dragInit = false;
        return;
      }
      dragging = false;
      dragInit = false;
      suppressClickAfterGesture = true;
      lastDragEndTime = Date.now();
      el.classList.remove('absolute-note-dragging');
      const c = noteContainer || document.body;
      const cRect = c.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const so = scrollOffset(c);
      note.posX_px = elRect.left - cRect.left - so.borderL + elRect.width / 2 + so.left;
      note.posY_px = elRect.top - cRect.top - so.borderT + so.top;
      el.style.left = note.posX_px + 'px';
      el.style.top = note.posY_px + 'px';
      note.anchor = note.anchor || 'top';
      persistNote(note);
      rebuildOutline();
    }

    function onClick(e) {
      e.stopPropagation();
    }

    el.addEventListener('mousedown', onStart);
    el.addEventListener('mousedown', captureHeaderStop, true);
    el.addEventListener('click', onClick);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchstart', captureHeaderStop, true);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);

    return function cleanup() {
      el.removeEventListener('mousedown', onStart);
      el.removeEventListener('mousedown', captureHeaderStop, true);
      el.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchstart', captureHeaderStop, true);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }

  function setupResizeObserver(el, note) {
    if (typeof ResizeObserver === 'undefined') return null;
    let raf = null;
    const ro = new ResizeObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const w = Math.round(el.offsetWidth);
        const h = Math.round(el.offsetHeight);
        if (note.w_px !== w) note.w_px = w;
        if (note.h_px !== h) note.h_px = h;
        el.style.left = note.posX_px + 'px';
        el.style.top = note.posY_px + 'px';
        persistNote(note);
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }

  function setupResizeGrip(el, note) {
    const grip = document.createElement('div');
    grip.className = 'absolute-note-resize';
    el.appendChild(grip);

    let resizing = false;
    let startX = 0, startY = 0;
    let startW = 0;
    let startH = 0;

    function onStart(e) {
      const ev = e.touches ? e.touches[0] : e;
      if (!el.offsetWidth || !el.offsetHeight) return;
      e.stopPropagation();
      e.preventDefault();
      resizing = true;
      startX = ev.clientX;
      startY = ev.clientY;
      startW = el.offsetWidth;
      startH = el.offsetHeight;
    }

    function onMove(e) {
      if (!resizing) return;
      e.stopPropagation();
      e.preventDefault();
      const ev = e.touches ? e.touches[0] : e;
      const w = Math.max(80, startW + (ev.clientX - startX));
      el.style.width = w + 'px';
    }

    function onEnd(e) {
      if (!resizing) return;
      resizing = false;
      suppressClickAfterGesture = true;
      lastDragEndTime = Date.now();
      note.w_px = Math.round(el.offsetWidth);
      note.h_px = Math.round(el.offsetHeight);
      persistNote(note);
    }

    grip.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    grip.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);

    return function cleanup() {
      grip.removeEventListener('mousedown', onStart);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      grip.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      if (grip.parentNode) grip.parentNode.removeChild(grip);
    };
  }

  function createNoteAt(clientX, clientY) {
    ensureContainer(document.elementFromPoint(clientX, clientY));
    const c = noteContainer || document.body;
    const cRect = c.getBoundingClientRect();
    const so = scrollOffset(c);
    const pageX = clientX - cRect.left - so.borderL + so.left;
    const pageY = clientY - cRect.top - so.borderT + so.top;

    chrome.storage.local.get(SETTINGS_KEY, (res) => {
      try { if (!chrome.runtime?.id) return; } catch (e) { return; }
      if (chrome.runtime.lastError) return;
      const s = res[SETTINGS_KEY] || {};
      const h = clampNum(s.height, 80, 2000, DEFAULT_SETTINGS.height);
      const note = {
        id: generateId(),
        text: '',
        locked: false,
        colorIndex: 0,
        anchor: 'top',
        posX_px: pageX,
        posY_px: pageY - h / 2,
        w_px: clampNum(s.width, 80, 2000, DEFAULT_SETTINGS.width),
        h_px: h,
        fontSize: clampNum(s.fontSize, 8, 72, DEFAULT_SETTINGS.fontSize),
      };
      renderNote(note, getStorageKey());
      persistNote(note);
      const el = document.getElementById('absolute-note-' + note.id);
      if (el) startInlineEdit(note, el);
      rebuildOutline();
    });
  }

  function isModalOpen() {
    return !!(noteModal && noteModal.style.display !== 'none');
  }

  function createNoteAtCenter() {
    if (isModalOpen()) return;
    createNoteAt(window.innerWidth / 2, window.innerHeight / 2);
  }

  let noteModal = null;
  let modalState = null;
  let modalSavedRange = null;

  function ensureModal() {
    if (noteModal) return noteModal;

    const overlay = document.createElement('div');
    overlay.className = 'absolute-note-modal';

    const dialog = document.createElement('div');
    dialog.className = 'absolute-note-modal-dialog';

    const title = document.createElement('div');
    title.className = 'absolute-note-modal-title';
    title.textContent = getText('edit_note');

    const editor = document.createElement('div');
    editor.className = 'absolute-note-modal-editor';
    editor.contentEditable = 'true';
    editor.setAttribute('data-placeholder', getText('outline_empty'));
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    });
    editor.addEventListener('blur', () => {
      if (!modalState) return;
      const sel = window.getSelection();
      if (sel.rangeCount > 0) modalSavedRange = sel.getRangeAt(0).cloneRange();
    });

    const toolbar = document.createElement('div');
    toolbar.className = 'absolute-note-modal-toolbar';
    toolbar.appendChild(toolbarBtn('B', 'bold', null, getText('bold')));
    toolbar.appendChild(toolbarBtn('I', 'italic', null, getText('italic')));
    toolbar.appendChild(toolbarBtn('U', 'underline', null, getText('underline')));

    const sizeSelect = document.createElement('select');
    sizeSelect.className = 'absolute-note-modal-size';
    sizeSelect.title = getText('font_size');
    [12, 14, 16, 18, 24, 32].forEach((px) => {
      const opt = document.createElement('option');
      opt.value = px;
      opt.textContent = px + 'px';
      sizeSelect.appendChild(opt);
    });
    sizeSelect.value = '14';
    sizeSelect.addEventListener('change', applySizeInput);
    toolbar.appendChild(sizeSelect);
    toolbar.appendChild(toolbarBtn('↺', 'removeFormat', null, getText('clear_format')));

    const actions = document.createElement('div');
    actions.className = 'absolute-note-modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'absolute-note-modal-btn absolute-note-modal-btn--cancel';
    cancelBtn.textContent = getText('cancel');
    cancelBtn.addEventListener('click', closeModal);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'absolute-note-modal-btn absolute-note-modal-btn--primary';
    saveBtn.textContent = getText('save');
    saveBtn.addEventListener('click', saveModalNote);

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    dialog.appendChild(title);
    dialog.appendChild(toolbar);
    dialog.appendChild(editor);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) closeModal();
    });
    overlay.addEventListener('contextmenu', (e) => e.preventDefault());

    ensureHost().appendChild(overlay);
    noteModal = overlay;
    return overlay;
  }

  function toolbarBtn(label, cmd, value, title) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'absolute-note-modal-btn';
    b.textContent = label;
    b.title = title || '';
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => {
      const editor = noteModal.querySelector('.absolute-note-modal-editor');
      editor.focus();
      document.execCommand(cmd, false, value);
    });
    return b;
  }

  function applyFontSize(px) {
    document.execCommand('fontSize', false, '7');
    const editor = noteModal.querySelector('.absolute-note-modal-editor');
    editor.querySelectorAll('font').forEach((f) => {
      const span = document.createElement('span');
      span.style.fontSize = px + 'px';
      while (f.firstChild) span.appendChild(f.firstChild);
      f.parentNode.replaceChild(span, f);
    });
  }

  function restoreModalSelection() {
    const editor = noteModal.querySelector('.absolute-note-modal-editor');
    const sel = window.getSelection();
    if (modalSavedRange) {
      sel.removeAllRanges();
      sel.addRange(modalSavedRange);
    } else {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function applySizeInput() {
    const input = noteModal.querySelector('.absolute-note-modal-size');
    const val = parseInt(input.value, 10);
    if (isNaN(val)) {
      input.value = '14';
      return;
    }
    const px = Math.min(72, Math.max(8, val));
    input.value = px;
    const editor = noteModal.querySelector('.absolute-note-modal-editor');
    editor.focus();
    restoreModalSelection();
    applyFontSize(px);
  }

  function openNoteModal(note, el) {
    const overlay = ensureModal();
    const editor = overlay.querySelector('.absolute-note-modal-editor');
    const sizeSelect = overlay.querySelector('.absolute-note-modal-size');
    editor.innerHTML = sanitizeHtml(note.text || '');
    if (sizeSelect) {
      const fs = note.fontSize || 14;
      const has = Array.prototype.some.call(sizeSelect.options, (o) => o.value === String(fs));
      if (!has) {
        const opt = document.createElement('option');
        opt.value = fs;
        opt.textContent = fs + 'px';
        sizeSelect.appendChild(opt);
      }
      sizeSelect.value = String(fs);
    }
    modalState = { note: note, el: el };
    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
  }

  function saveModalNote() {
    if (!modalState) return;
    const { note, el } = modalState;
    const editor = noteModal.querySelector('.absolute-note-modal-editor');
    note.text = sanitizeHtml(editor.innerHTML);
    const body = el.querySelector('.absolute-note-body');
    if (body) body.innerHTML = note.text;
    persistNote(note);
    rebuildOutline();
    closeModal();
  }

  function closeModal() {
    if (!noteModal) return;
    noteModal.style.display = 'none';
    modalState = null;
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
      const lockBtn = document.createElement('span');
      lockBtn.className = 'absolute-note-outline-lock';
      const noteObj = notesById.get(n.id);
      const isLocked = noteObj ? noteObj.locked : n.el.classList.contains('absolute-note--locked');
      lockBtn.textContent = isLocked ? '🔒' : '🔓';
      lockBtn.title = isLocked ? getText('unlock') : getText('lock');
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const note = notesById.get(n.id);
        if (!note) return;
        note.locked = !note.locked;
        n.el.classList.toggle('absolute-note--locked', note.locked);
        lockBtn.textContent = note.locked ? '🔒' : '🔓';
        lockBtn.title = note.locked ? getText('unlock') : getText('lock');
        persistNote(note);
      });
      item.appendChild(lockBtn);
      const editBtn = document.createElement('span');
      editBtn.className = 'absolute-note-outline-edit';
      editBtn.textContent = '✏️';
      editBtn.title = getText('edit');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const note = notesById.get(n.id);
        if (note && !note.locked) startInlineEdit(note, n.el);
      });
      item.appendChild(editBtn);
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

    const headerActions = document.createElement('div');
    headerActions.className = 'absolute-note-outline-actions';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'absolute-note-outline-close';
    closeBtn.textContent = '×';
    closeBtn.title = getText('close');
    closeBtn.addEventListener('click', () => {
      outlinePanel.style.display = 'none';
      saveOutlineState('hidden');
    });

    const ejectBtn = document.createElement('button');
    ejectBtn.className = 'absolute-note-outline-eject';
    ejectBtn.type = 'button';
    ejectBtn.textContent = '⧉';
    ejectBtn.title = getText('eject_outline');
    ejectBtn.addEventListener('click', () => {
      openOutlineWindow();
    });

    header.appendChild(title);
    headerActions.appendChild(ejectBtn);
    headerActions.appendChild(closeBtn);
    header.appendChild(headerActions);

    const list = document.createElement('div');
    list.className = 'absolute-note-outline-list';

    const footer = document.createElement('div');
    footer.className = 'absolute-note-outline-footer';

    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'absolute-note-outline-create';
    createBtn.textContent = getText('create_note');
    createBtn.addEventListener('click', () => {
      createNoteAtCenter();
    });
    footer.appendChild(createBtn);

    outlinePanel.appendChild(header);
    outlinePanel.appendChild(list);
    outlinePanel.appendChild(footer);
    ensureHost().appendChild(outlinePanel);

    rebuildOutline();
    saveOutlineState('visible');
  }

  function saveOutlineState(state) {
    try {
      chrome.storage.local.set({
        ['absolute_note_outline_' + window.location.href]: state,
      });
    } catch (e) {}
  }

  function restoreOutlineState() {
    try {
      chrome.storage.local.get('absolute_note_outline_' + window.location.href, (result) => {
        try { if (!chrome.runtime?.id) return; } catch (e) { return; }
        if (chrome.runtime.lastError) return;
        if (result['absolute_note_outline_' + window.location.href] === 'visible') {
          showOutline();
        }
      });
    } catch (e) {}
  }

  function toggleHideNotes() {
    var hidden = document.documentElement.classList.toggle('absolute-note-notes-hidden');
    saveHideState(hidden ? 'hidden' : 'visible');
  }

  function saveHideState(state) {
    try {
      chrome.storage.local.set({
        ['absolute_note_hide_' + window.location.href]: state,
      });
    } catch (e) {}
  }

  function restoreHideState() {
    try {
      chrome.storage.local.get('absolute_note_hide_' + window.location.href, (result) => {
        try { if (!chrome.runtime?.id) return; } catch (e) { return; }
        if (chrome.runtime.lastError) return;
        if (result['absolute_note_hide_' + window.location.href] === 'hidden') {
          document.documentElement.classList.add('absolute-note-notes-hidden');
        }
      });
    } catch (e) {}
  }

  let lastUrl = window.location.href;
  let settleTimer = null;
  let settleObserver = null;
  let migrateTimer = null;
  let migrateObserver = null;

  function cancelSettleWatch() {
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
    if (settleObserver) { settleObserver.disconnect(); settleObserver = null; }
  }

  function clearAllNotes() {
    document.querySelectorAll('.absolute-note').forEach((el) => {
      const id = el.getAttribute('data-note-id');
      const clean = noteCleanups.get(id);
      if (clean) { clean(); noteCleanups.delete(id); }
      el.remove();
    });
    notesById.clear();
    noteKeys.clear();
    editingNoteId = null;
  }

  function handleUrlChange() {
    const currentUrl = window.location.href;
    if (currentUrl === lastUrl) return;
    lastUrl = currentUrl;
    if (migrateTimer) { clearTimeout(migrateTimer); migrateTimer = null; }
    cancelSettleWatch();
    clearAllNotes();
    if (outlinePanel) { outlinePanel.remove(); outlinePanel = null; }
    if (noteModal) { noteModal.remove(); noteModal = null; modalState = null; }
    noteContainer = null;

    scheduleLoadAfterSettle(3000);
    setTimeout(() => {
      if (window.location.href === currentUrl) loadAndRender();
    }, 0);
  }

  function scheduleLoadAfterSettle(maxWait) {
    settleObserver = new MutationObserver(() => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(onDomSettled, 600);
    });
    settleObserver.observe(document.body, { childList: true, subtree: true });
    settleTimer = setTimeout(onDomSettled, maxWait);
  }

  function onDomSettled() {
    cancelSettleWatch();
    loadAndRender();
  }

  function loadAndRender() {
    const refEl = document.querySelector('.absolute-note') ||
      document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    ensureContainer(refEl || document.body);
    loadNotes();
    restoreOutlineState();
    restoreHideState();
  }

  function maybeMigrateContainer() {
    if (window.location.href !== lastUrl) return;
    const current = noteContainer;
    if (current && current.isConnected && !isDefaultContainer(current)) {
      return;
    }
    if (current && !current.isConnected) {
      noteContainer = null;
      loadAndRender();
      return;
    }
    const noteEl = document.querySelector('.absolute-note');
    if (!noteEl) return;
    const r = noteEl.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const px = Math.round(r.left + r.width / 2);
    const py = Math.round(r.top + r.height / 2);
    const stack = document.elementsFromPoint(px, py);
    const pageEl = stack.find((el) => !el.closest('.absolute-note, .absolute-note-modal, .absolute-note-outline'));
    if (!pageEl) {
      const cx = Math.round(window.innerWidth / 2);
      const cy = Math.round(window.innerHeight / 2);
      const vpEl = document.elementsFromPoint(cx, cy).find((el) =>
        !el.closest('.absolute-note, .absolute-note-modal, .absolute-note-outline'));
      if (!vpEl) return;
      const detected = findScrollContainer(vpEl);
      if (isDefaultContainer(detected) || detected === noteContainer) return;
      noteContainer = detected;
      if (!isDefaultContainer(detected)) detected.style.position = 'relative';
      clearAllNotes();
      loadNotes();
      return;
    }
    const detected = findScrollContainer(pageEl);
    if (!isDefaultContainer(detected)) {
      ensureContainer(pageEl);
    }
  }

  function watchContainer() {
    if (migrateObserver) return;
    migrateObserver = new MutationObserver(() => {
      clearTimeout(migrateTimer);
      migrateTimer = setTimeout(maybeMigrateContainer, 400);
    });
    migrateObserver.observe(document.body, { childList: true, subtree: true });
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
      scheduleLoadAfterSettle(2000);
      watchContainer();
    });
  }

  function applyLangUi() {
    document.querySelectorAll('.absolute-note').forEach((el) => {
      const deleteBtn = el.querySelector('.absolute-note-delete');
      if (deleteBtn) deleteBtn.title = getText('delete');
    });
    if (outlinePanel) {
      const title = outlinePanel.querySelector('.absolute-note-outline-header span');
      if (title) title.textContent = getText('outline_title');
      rebuildOutline();
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.absolute_note_lang) {
      setLang(changes.absolute_note_lang.newValue);
      applyLangUi();
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (window.self !== window.top) return;
    if (msg.action === 'createNote') {
      createNoteAtCenter();
    } else if (msg.action === 'getState') {
      sendResponse({
        hasNotes: document.querySelectorAll('.absolute-note').length > 0,
        hidden: document.documentElement.classList.contains('absolute-note-notes-hidden'),
        modalOpen: isModalOpen(),
      });
    } else if (msg.action === 'reloadNotes') {
      clearAllNotes();
      loadNotes();
    } else if (msg.action === 'openOutline') {
      showOutline();
    } else if (msg.action === 'toggleOutline') {
      toggleOutline();
    } else if (msg.action === 'toggleHideNotes') {
      toggleHideNotes();
    } else if (msg.action === 'outlineAddNote') {
      const id = msg.id;
      if (msg.cmd === 'addNote') {
        createNoteAtCenter();
      } else if (msg.cmd === 'scrollToNote') {
        scrollToNoteById(id);
      } else if (msg.cmd === 'editNote') {
        editNoteById(id);
      } else if (msg.cmd === 'deleteNote') {
        deleteNote(id);
      } else if (msg.cmd === 'toggleLock') {
        toggleLockById(id);
      }
      sendResponse({ ok: true });
    } else if (msg.action === 'setLang') {
      setLang(msg.lang);
      applyLangUi();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
