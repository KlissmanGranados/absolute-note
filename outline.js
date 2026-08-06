(function () {
  const STORAGE_PREFIX = 'absolute_note_';
  const COLORS = [
    { bg: '#fff9c4', border: '#f0e68c' },
    { bg: '#bbdefb', border: '#90caf9' },
    { bg: '#c8e6c9', border: '#a5d6a7' },
    { bg: '#f8bbd0', border: '#f48fb1' },
  ];
  const EL_COUNT = 'outline_title_count';

  let ctx = null;
  let statusTimer = null;

  const els = {
    title: document.getElementById('title'),
    notes: document.getElementById('notes'),
    empty: document.getElementById('empty'),
    lost: document.getElementById('lost'),
    addNote: document.getElementById('add-note'),
    status: document.getElementById('status'),
  };

  function showStatus(text, isError) {
    els.status.textContent = text || '';
    els.status.style.color = isError ? '#c00' : '#2e7d32';
    clearTimeout(statusTimer);
    if (text) {
      statusTimer = setTimeout(() => { els.status.textContent = ''; }, 2000);
    }
  }

  function storageKey() {
    return ctx && ctx.url ? STORAGE_PREFIX + ctx.url : null;
  }

  function setCtx(next) {
    ctx = next && next.tabId != null ? next : null;
    render();
  }

  function loadNotes(callback) {
    const key = storageKey();
    if (!key) { callback([]); return; }
    chrome.storage.local.get(key, (res) => {
      if (chrome.runtime.lastError) { callback([]); return; }
      callback(res[key] || []);
    });
  }

  function stripHTML(html) {
    const t = document.createElement('div');
    t.innerHTML = html || '';
    return t.textContent || '';
  }

  function labelText(html) {
    const t = stripHTML(html).trim() || getText('outline_empty');
    return t.length > 50 ? t.slice(0, 50) + '...' : t;
  }

  function send(cmd, id, done) {
    if (!ctx || ctx.tabId == null) {
      done(new Error('no-tab'));
      return;
    }
    chrome.tabs.sendMessage(ctx.tabId, { action: 'outlineAddNote', cmd, id }, (resp) => {
      if (chrome.runtime.lastError) {
        done(new Error(chrome.runtime.lastError.message));
        return;
      }
      done(null, resp);
    });
  }

  function actionFailed() {
    els.lost.style.display = 'block';
    els.lost.textContent = getText('outline_target_lost');
    els.empty.style.display = 'none';
  }

  function wrap(cmd, id, okLabel) {
    send(cmd, id, (err) => {
      if (err) {
        actionFailed();
        return;
      }
      if (okLabel) showStatus(getText(okLabel));
    });
  }

  function render() {
    const key = storageKey();
    if (!ctx || ctx.tabId == null || !key) {
      els.empty.style.display = 'none';
      els.lost.style.display = 'block';
      els.lost.textContent = getText('outline_target_lost');
      els.notes.innerHTML = '';
      els.title.textContent = getText('outline_title');
      return;
    }
    els.lost.style.display = 'none';

    loadNotes((notes) => {
      const sorted = notes.slice().sort((a, b) => (a.posY_px || 0) - (b.posY_px || 0));
      if (sorted.length === 0) {
        els.empty.style.display = 'block';
        els.empty.textContent = getText('no_notes_empty');
      } else {
        els.empty.style.display = 'none';
      }
      els.title.textContent = getText(EL_COUNT, { count: sorted.length });
      els.notes.innerHTML = '';

      sorted.forEach((note, i) => {
        const li = document.createElement('li');
        li.className = 'item';

        const dot = document.createElement('span');
        dot.className = 'dot';
        const c = COLORS[note.colorIndex] || COLORS[0];
        dot.style.background = c.bg;
        dot.style.borderColor = c.border;

        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = '#' + (i + 1) + ' ' + labelText(note.text);

        li.appendChild(dot);
        li.appendChild(label);

        const lockBtn = document.createElement('span');
        lockBtn.className = 'act';
        lockBtn.textContent = note.locked ? '🔒' : '🔓';
        lockBtn.title = note.locked ? getText('unlock') : getText('lock');
        lockBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          wrap('toggleLock', note.id, 'lock');
        });
        li.appendChild(lockBtn);

        const editBtn = document.createElement('span');
        editBtn.className = 'act';
        editBtn.textContent = '✏️';
        editBtn.title = getText('edit');
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          wrap('editNote', note.id, 'edit');
        });
        li.appendChild(editBtn);

        const delBtn = document.createElement('span');
        delBtn.className = 'act del';
        delBtn.textContent = '×';
        delBtn.title = getText('delete');
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          wrap('deleteNote', note.id, 'delete');
        });
        li.appendChild(delBtn);

        li.addEventListener('click', () => {
          wrap('scrollToNote', note.id, null);
        });

        els.notes.appendChild(li);
      });
    });
  }

  function refreshLanguageUi() {
    els.addNote.textContent = getText('create_note');
    render();
  }

  chrome.runtime.sendMessage({ action: 'getOutlineContext' }, (resp) => {
    if (chrome.runtime.lastError || !resp) {
      setCtx(null);
      return;
    }
    setCtx(resp);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const key = storageKey();
    if (key && changes[key] !== undefined) {
      render();
    }
  });

  els.addNote.addEventListener('click', () => {
    wrap('addNote', null, 'create_note');
  });

  chrome.storage.local.get('absolute_note_lang', (result) => {
    if (result.absolute_note_lang) setLang(result.absolute_note_lang);
    refreshLanguageUi();
  });
})();