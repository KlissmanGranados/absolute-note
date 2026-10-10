import { COLORS } from '../../shared/constants.js';
import { getText } from '../../shared/i18n.js';
import { htmlToText } from '../../shared/sanitize.js';

const LABEL_MAX = 50;

function labelFor(note, index) {
  const text = htmlToText(note.text).trim() || getText('outline_empty');
  return '#' + (index + 1) + ' ' + (text.length > LABEL_MAX ? text.slice(0, LABEL_MAX) + '...' : text);
}

function actionButton(className, text, title, onClick) {
  const btn = document.createElement('span');
  btn.className = className;
  btn.textContent = text;
  btn.title = title;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

// Renders the note list used by both the in-page outline panel and the detached outline window.
// Notes are listed top to bottom by their position on the page.
export function renderOutlineList(list, notes, { onSelect, onToggleLock, onEdit, onDelete }) {
  const sorted = notes.slice().sort((a, b) => a.posY_px - b.posY_px);
  list.replaceChildren(
    ...sorted.map((note, i) => {
      const item = document.createElement('div');
      item.className = 'absolute-note-outline-item';

      const dot = document.createElement('span');
      dot.className = 'absolute-note-outline-dot';
      const c = COLORS[note.colorIndex] || COLORS[0];
      dot.style.background = c.bg;
      dot.style.borderColor = c.border;

      const label = document.createElement('span');
      label.className = 'absolute-note-outline-label';
      label.textContent = labelFor(note, i);

      item.append(
        dot,
        label,
        actionButton('absolute-note-outline-lock', note.locked ? '🔒' : '🔓', getText(note.locked ? 'unlock' : 'lock'), () =>
          onToggleLock(note.id),
        ),
        actionButton('absolute-note-outline-edit', '✏️', getText('edit'), () => onEdit(note.id)),
        actionButton('absolute-note-outline-del', '×', getText('delete'), () => onDelete(note.id)),
      );
      item.addEventListener('click', () => onSelect(note.id));
      return item;
    }),
  );
  return sorted.length;
}
