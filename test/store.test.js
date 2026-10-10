import { beforeEach, describe, expect, it } from 'vitest';
import { notesKey } from '../src/shared/constants.js';
import * as store from '../src/shared/store.js';
import { installFakeExt } from './helpers/fake-ext.js';

const PAGE = 'https://example.com/page';
const KEY = notesKey(PAGE);
const note = (id, extra = {}) => ({ id, text: '', locked: false, colorIndex: 0, anchor: 'top', posX_px: 0, posY_px: 0, ...extra });

let fake;
beforeEach(() => {
  fake = installFakeExt();
});

describe('note writes', () => {
  it('does not lose concurrent writes from the same context', async () => {
    await Promise.all(Array.from({ length: 25 }, (_, i) => store.addNote(PAGE, note('n' + i))));
    expect(fake.data[KEY]).toHaveLength(25);

    await Promise.all(Array.from({ length: 25 }, (_, i) => store.patchNote(PAGE, 'n' + i, { posX_px: i })));
    expect(fake.data[KEY].map((n) => n.posX_px)).toEqual(Array.from({ length: 25 }, (_, i) => i));
  });

  it('patches only the given fields', async () => {
    await store.addNote(PAGE, note('a', { text: 'hello', colorIndex: 1 }));
    await store.patchNote(PAGE, 'a', { posY_px: 99 });
    expect(fake.data[KEY][0]).toMatchObject({ text: 'hello', colorIndex: 1, posY_px: 99 });
  });

  it('does not resurrect a deleted note when a late patch arrives', async () => {
    await store.addNote(PAGE, note('a'));
    await store.addNote(PAGE, note('b'));
    await Promise.all([store.removeNote(PAGE, 'a'), store.patchNote(PAGE, 'a', { w_px: 300 })]);
    expect(fake.data[KEY].map((n) => n.id)).toEqual(['b']);
  });

  it('removes the key when the last note is deleted', async () => {
    await store.addNote(PAGE, note('a'));
    await store.removeNote(PAGE, 'a');
    expect(KEY in fake.data).toBe(false);
  });

  it('reports pending writes until they settle', async () => {
    const write = store.addNote(PAGE, note('a'));
    expect(store.hasPendingWrites(PAGE)).toBe(true);
    await write;
    await store.whenWritesSettle(PAGE);
    expect(store.hasPendingWrites(PAGE)).toBe(false);
  });

  it('notifies subscribers with normalized notes', async () => {
    const received = [];
    const unsubscribe = store.onNotesChanged(PAGE, (notes) => received.push(notes));
    await store.addNote(PAGE, note('a'));
    await store.removeNote(PAGE, 'a');
    unsubscribe();
    await store.addNote(PAGE, note('b'));
    expect(received).toEqual([[note('a')], []]);
  });
});

describe('page ui state', () => {
  it('stores only non-default values', async () => {
    await store.setOutlineVisible(PAGE, true);
    await store.setNotesHidden(PAGE, true);
    expect(await store.loadPageUiState(PAGE)).toEqual({ outlineVisible: true, notesHidden: true });
    await store.setOutlineVisible(PAGE, false);
    await store.setNotesHidden(PAGE, false);
    expect(await store.loadPageUiState(PAGE)).toEqual({ outlineVisible: false, notesHidden: false });
    expect(Object.keys(fake.data)).toEqual([]);
  });
});

describe('settings', () => {
  it('clamps stored values and falls back to defaults', async () => {
    installFakeExt({ absolute_note_settings: { width: 5, height: 'x', fontSize: 100 } });
    expect(await store.loadSettings()).toEqual({ width: 80, height: 325, fontSize: 72 });
  });
});
