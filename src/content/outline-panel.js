import { getText } from '../shared/i18n.js';
import { wordsLabel } from '../shared/words-label.js';
import { renderOutlineList } from '../ui/shared/outline-list.js';

// Side panel listing the page's notes, rendered inside the shadow root of the extension's fixed host.
export class OutlinePanel {
  constructor(host, { onCreate, onEject, onClose, listHandlers }) {
    this.listHandlers = listHandlers;

    const panel = document.createElement('div');
    panel.className = 'absolute-note-outline';

    const header = document.createElement('div');
    header.className = 'absolute-note-outline-header';
    this.title = document.createElement('span');

    const actions = document.createElement('div');
    actions.className = 'absolute-note-outline-actions';

    this.ejectBtn = document.createElement('button');
    this.ejectBtn.type = 'button';
    this.ejectBtn.className = 'absolute-note-outline-eject';
    this.ejectBtn.textContent = '⧉';
    this.ejectBtn.addEventListener('click', onEject);

    this.closeBtn = document.createElement('button');
    this.closeBtn.type = 'button';
    this.closeBtn.className = 'absolute-note-outline-close';
    this.closeBtn.textContent = '×';
    this.closeBtn.addEventListener('click', onClose);

    actions.append(this.ejectBtn, this.closeBtn);
    header.append(this.title, actions);

    this.list = document.createElement('div');
    this.list.className = 'absolute-note-outline-list';

    this.words = document.createElement('div');
    this.words.className = 'absolute-note-outline-words';

    const footer = document.createElement('div');
    footer.className = 'absolute-note-outline-footer';
    this.createBtn = document.createElement('button');
    this.createBtn.type = 'button';
    this.createBtn.className = 'absolute-note-outline-create';
    this.createBtn.addEventListener('click', onCreate);
    footer.appendChild(this.createBtn);

    panel.append(header, this.list, this.words, footer);
    host.appendChild(panel);
    this.panel = panel;
    this.notes = [];
    this.applyLang();
  }

  get visible() {
    return this.panel.style.display !== 'none';
  }

  show() {
    this.panel.style.display = '';
    this.render(this.notes);
  }

  hide() {
    this.panel.style.display = 'none';
  }

  render(notes) {
    this.notes = notes;
    if (!this.visible) return;
    const count = renderOutlineList(this.list, notes, this.listHandlers);
    this.title.textContent = getText('outline_title_count', { count });
    this.words.textContent = wordsLabel(notes);
  }

  applyLang() {
    this.title.textContent = getText('outline_title');
    this.ejectBtn.title = getText('eject_outline');
    this.closeBtn.title = getText('close');
    this.createBtn.textContent = getText('create_note');
    this.render(this.notes);
  }

  destroy() {
    this.panel.remove();
  }
}
