import { getText } from './i18n.js';
import { totalWords } from './text.js';

// "Total: 12 words" for the notes of a page (shown in both outlines).
export function wordsLabel(notes) {
  const words = totalWords(notes);
  return getText('outline_words', { words: getText(words === 1 ? 'words_one' : 'words_other', { count: words }) });
}
