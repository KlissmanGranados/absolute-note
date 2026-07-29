(function () {
  const STORAGE_PREFIX = 'absolute_note_';
  const COLORS = [
    { bg: '#fff9c4', border: '#f0e68c', header: '#f5eaa0' },
    { bg: '#bbdefb', border: '#90caf9', header: '#90caf9' },
    { bg: '#c8e6c9', border: '#a5d6a7', header: '#a5d6a7' },
    { bg: '#f8bbd0', border: '#f48fb1', header: '#f48fb1' },
  ];

  let scrollContainer = null;
  let lastClickX = 0;
  let lastClickY = 0;

  function getStorageKey() {
    return STORAGE_PREFIX + window.location.href;
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function findScrollContainer(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      const style = window.getComputedStyle(el);
      if (
        style.overflowY === 'auto' ||
        style.overflowY === 'scroll' ||
        style.overflow === 'auto' ||
        style.overflow === 'scroll'
      ) {
        if (el.scrollHeight > el.clientHeight) {
          return el;
        }
      }
      el = el.parentElement;
    }
    return document.scrollingElement || document.documentElement || document.body;
  }

  function getContainer() {
    return scrollContainer || document.body;
  }

  function pageXToPct(pageX) {
    const c = getContainer();
    return (pageX / c.scrollWidth) * 100;
  }

  function pageYToPct(pageY) {
    const c = getContainer();
    return (pageY / c.scrollHeight) * 100;
  }

  function pctToPageX(pctX) {
    const c = getContainer();
    return (pctX / 100) * c.scrollWidth;
  }

  function pctToPageY(pctY) {
    const c = getContainer();
    return (pctY / 100) * c.scrollHeight;
  }

  function applyColor(el, note) {
    const c = COLORS[note.colorIndex] || COLORS[0];
    el.style.background = c.bg;
    el.style.borderColor = c.border;
    el.setAttribute('data-color-index', note.colorIndex);
    const h = el.querySelector('.absolute-note-header');
    if (h) h.style.background = c.header;
  }

  function loadNotes() {
    const key = getStorageKey();
    chrome.storage.local.get(key, (result) => {
      const notes = result[key] || [];
      notes.forEach((note) => renderNote(note));
    });
  }

  function saveNotes(notes) {
    const key = getStorageKey();
    chrome.storage.local.set({ [key]: notes });
  }

  function getNotes(callback) {
    const key = getStorageKey();
    chrome.storage.local.get(key, (result) => {
      callback(result[key] || []);
    });
  }

  function renderNote(note) {
    if (document.getElementById('absolute-note-' + note.id)) return;

    if (note.colorIndex == null) note.colorIndex = 0;

    const el = document.createElement('div');
    el.className = 'absolute-note';
    el.id = 'absolute-note-' + note.id;
    el.setAttribute('data-note-id', note.id);
    applyColor(el, note);
    el.style.left = pctToPageX(note.posX_porc) + 'px';
    el.style.top = pctToPageY(note.posY_porc) + 'px';

    const header = document.createElement('div');
    header.className = 'absolute-note-header';

    const lockBtn = document.createElement('button');
    lockBtn.className = 'absolute-note-lock';
    lockBtn.textContent = note.locked ? '🔒' : '🔓';
    lockBtn.title = note.locked ? 'Desbloquear nota' : 'Bloquear nota';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'absolute-note-delete';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Eliminar nota';

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
      lockBtn.title = note.locked ? 'Desbloquear nota' : 'Bloquear nota';
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

    header.appendChild(lockBtn);
    header.appendChild(colorsWrap);
    header.appendChild(deleteBtn);
    el.appendChild(header);
    el.appendChild(body);
    getContainer().appendChild(el);

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

    function beginDrag(ev) {
      dragging = true;
      wasEditing = body.contentEditable === 'true';
      const rect = el.getBoundingClientRect();
      offsetX = ev.clientX - rect.left;
      offsetY = ev.clientY - rect.top;
      body.contentEditable = 'false';
    }

    function onStart(e) {
      const ev = e.touches ? e.touches[0] : e;
      if (note.locked) return;
      if (e.target.closest('.absolute-note-delete, .absolute-note-lock')) return;
      if (e.target.closest('.absolute-note-colors')) return;
      dragInit = true;
      startX = ev.clientX;
      startY = ev.clientY;
    }

    function onMove(e) {
      const ev = e.touches ? e.touches[0] : e;
      if (!dragging && dragInit) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
          beginDrag(ev);
        } else {
          return;
        }
      }
      if (!dragging) return;
      e.preventDefault();
      const c = getContainer();
      const cRect = c.getBoundingClientRect();
      const scrollLeft = 'scrollLeft' in c ? c.scrollLeft : 0;
      const scrollTop = 'scrollTop' in c ? c.scrollTop : 0;
      const pageX = ev.clientX - offsetX - cRect.left + scrollLeft;
      const pageY = ev.clientY - offsetY - cRect.top + scrollTop;
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
      if (wasEditing && !note.locked) {
        body.contentEditable = 'true';
      } else {
        body.contentEditable = 'false';
      }
      const c = getContainer();
      const cRect = c.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const scrollLeft = 'scrollLeft' in c ? c.scrollLeft : 0;
      const scrollTop = 'scrollTop' in c ? c.scrollTop : 0;
      const centerPageX = elRect.left - cRect.left + elRect.width / 2 + scrollLeft;
      const centerPageY = elRect.top - cRect.top + elRect.height / 2 + scrollTop;
      note.posX_porc = pageXToPct(centerPageX);
      note.posY_porc = pageYToPct(centerPageY);
      el.style.left = pctToPageX(note.posX_porc) + 'px';
      el.style.top = pctToPageY(note.posY_porc) + 'px';
      persistNote(note);
      rebuildOutline();
    }

    el.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    el.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }

  function createNoteAt(clientX, clientY) {
    if (!scrollContainer) {
      scrollContainer = findScrollContainer(document.elementFromPoint(clientX, clientY));
      if (scrollContainer && scrollContainer !== document.body) {
        scrollContainer.style.position = 'relative';
      }
    }

    const c = getContainer();
    const cRect = c.getBoundingClientRect();
    const scrollLeft = 'scrollLeft' in c ? c.scrollLeft : 0;
    const scrollTop = 'scrollTop' in c ? c.scrollTop : 0;
    const pageX = clientX - cRect.left + scrollLeft;
    const pageY = clientY - cRect.top + scrollTop;

    const note = {
      id: generateId(),
      text: '',
      locked: false,
      colorIndex: 0,
      posX_porc: pageXToPct(pageX),
      posY_porc: pageYToPct(pageY),
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
    chrome.storage.local.get(null, (data) => {
      const prefix = STORAGE_PREFIX;
      const filtered = {};
      for (const key in data) {
        if (key.startsWith(prefix)) {
          filtered[key] = data[key];
        }
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
            for (const key in existing) {
              if (key.startsWith(prefix)) {
                merged[key] = existing[key];
              }
            }
            for (const key in imported) {
              if (key.startsWith(prefix)) {
                merged[key] = imported[key];
              }
            }
            chrome.storage.local.set(merged, () => {
              const notes = merged[STORAGE_PREFIX + window.location.href] || [];
              document.querySelectorAll('.absolute-note').forEach((el) => el.remove());
              notes.forEach((note) => renderNote(note));
              rebuildOutline();
            });
          });
        } catch {
          alert('Error: el archivo no contiene JSON válido.');
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
      const raw = body ? body.textContent.trim() || '(sin texto)' : '(sin texto)';
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
      item.addEventListener('click', () => {
        const el = document.getElementById('absolute-note-' + n.id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.boxShadow = '0 0 0 3px #1565c0, 2px 4px 12px rgba(0,0,0,0.25)';
          setTimeout(() => {
            el.style.boxShadow = '';
          }, 2000);
          requestAnimationFrame(() => {
            const body = el.querySelector('.absolute-note-body');
            if (body) body.click();
          });
        }
      });
      list.appendChild(item);
    });
    if (headerTitle) {
      headerTitle.textContent = 'Esquema de notas (' + allNotes.length + ')';
    }
  }

  function toggleOutline() {
    if (outlinePanel) {
      if (outlinePanel.style.display === 'none') {
        outlinePanel.style.display = '';
        rebuildOutline();
      } else {
        outlinePanel.style.display = 'none';
      }
      return;
    }

    outlinePanel = document.createElement('div');
    outlinePanel.className = 'absolute-note-outline';

    const header = document.createElement('div');
    header.className = 'absolute-note-outline-header';

    const title = document.createElement('span');
    title.textContent = 'Esquema de notas';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'absolute-note-outline-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => {
      outlinePanel.style.display = 'none';
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    const list = document.createElement('div');
    list.className = 'absolute-note-outline-list';

    outlinePanel.appendChild(header);
    outlinePanel.appendChild(list);
    document.body.appendChild(outlinePanel);

    rebuildOutline();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'createNote') {
      createNoteAt(lastClickX, lastClickY);
    } else if (msg.action === 'exportNotes') {
      exportNotes();
    } else if (msg.action === 'importNotes') {
      importNotes();
    } else if (msg.action === 'toggleOutline') {
      toggleOutline();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNotes);
  } else {
    loadNotes();
  }
})();
