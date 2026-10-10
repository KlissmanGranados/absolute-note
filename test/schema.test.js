import { describe, expect, it } from 'vitest';
import { normalizeNote, normalizeNotes } from '../src/shared/schema.js';

describe('normalizeNote', () => {
  it('keeps a current note as is', () => {
    const note = {
      id: 'abc',
      text: '<p>hi</p>',
      locked: true,
      colorIndex: 2,
      anchor: 'top',
      posX_px: 350,
      posY_px: 1200,
      w_px: 170,
      h_px: 325,
      fontSize: 14,
    };
    expect(normalizeNote(note)).toEqual(note);
  });

  it('migrates center-anchored notes and drops the legacy key field', () => {
    const note = normalizeNote({ id: 'a', text: 't', posX_px: 10, posY_px: 500, h_px: 200, key: 'absolute_note_x' });
    expect(note.anchor).toBe('top');
    expect(note.posY_px).toBe(400);
    expect(note).not.toHaveProperty('key');
  });

  it('uses the default height when migrating notes without a size', () => {
    expect(normalizeNote({ id: 'a', posY_px: 500 }).posY_px).toBe(500 - 325 / 2);
  });

  it('coerces invalid fields', () => {
    const note = normalizeNote({ id: '', text: 5, locked: 'yes', colorIndex: 9, posX_px: 'abc', posY_px: '12.5', anchor: 'top', fontSize: 500 });
    expect(note.id).toMatch(/\w+/);
    expect(note.text).toBe('');
    expect(note.locked).toBe(false);
    expect(note.colorIndex).toBe(0);
    expect(note.posX_px).toBe(0);
    expect(note.posY_px).toBe(12.5);
    expect(note.fontSize).toBe(72);
  });

  it('treats zero sizes (saved while notes were hidden) as absent', () => {
    const note = normalizeNote({ id: 'a', anchor: 'top', w_px: 0, h_px: 0 });
    expect(note).not.toHaveProperty('w_px');
    expect(note).not.toHaveProperty('h_px');
  });

  it('rejects non-objects', () => {
    expect(normalizeNote(null)).toBeNull();
    expect(normalizeNote('x')).toBeNull();
    expect(normalizeNote([])).toBeNull();
  });
});

describe('normalizeNotes', () => {
  it('drops invalid entries and duplicate ids', () => {
    const notes = normalizeNotes([{ id: 'a', anchor: 'top' }, null, { id: 'a', anchor: 'top', text: 'dup' }, { id: 'b', anchor: 'top' }]);
    expect(notes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(notes[0].text).toBe('');
  });

  it('returns an empty list for missing data', () => {
    expect(normalizeNotes(undefined)).toEqual([]);
  });
});
