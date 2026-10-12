const BLOCK_TAGS = 'br, p, div, li, ul, ol';

// Plain text of a note's HTML (never rendered). Line breaks and blocks separate words even when no
// whitespace sits between them ("one<br>two" reads "one two").
export function htmlToText(html) {
  if (!html) return '';
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  body.querySelectorAll(BLOCK_TAGS).forEach((el) => {
    el.before(' ');
    el.after(' ');
  });
  return (body.textContent || '').replace(/\s+/g, ' ').trim();
}

export function countWords(html) {
  const text = htmlToText(html);
  return text ? text.split(' ').length : 0;
}

// Words across every note of a page.
export function totalWords(notes) {
  return notes.reduce((sum, n) => sum + countWords(n.text), 0);
}
