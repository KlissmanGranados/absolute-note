import { describe, expect, it } from 'vitest';
import { collectNotes, isImportPayload, mergeImport } from '../src/shared/backup.js';
import { SCHEMA_VERSION } from '../src/shared/constants.js';
import { planMigration, runMigrations } from '../src/shared/migrate.js';
import { sanitizeHtml } from '../src/shared/sanitize.js';
import { installFakeExt } from './helpers/fake-ext.js';

const note = (id, extra = {}) => ({ id, text: '', locked: false, colorIndex: 0, anchor: 'top', posX_px: 0, posY_px: 0, ...extra });

describe('collectNotes', () => {
  it('exports only non-empty note arrays', () => {
    const all = {
      'absolute_note_https://a.com/': [note('1'), note('2')],
      'absolute_note_https://b.com/': [],
      absolute_note_settings: { width: 100 },
      absolute_note_lang: 'es',
      'absolute_note_outline_https://a.com/': 'visible',
    };
    expect(collectNotes(all)).toEqual({
      data: { 'absolute_note_https://a.com/': [note('1'), note('2')] },
      pages: 1,
      count: 2,
    });
  });
});

describe('mergeImport', () => {
  it('adds new notes, skips existing ids and sanitizes text', () => {
    const existing = { 'absolute_note_https://a.com/': [note('1', { text: 'mine' })] };
    const imported = {
      'absolute_note_https://a.com/': [note('1', { text: 'theirs' }), note('2', { text: '<a><img src=x onerror=alert(1)></a>ok' })],
      'absolute_note_https://b.com/': [note('3')],
      absolute_note_settings: { width: 1 },
      unrelated: [note('4')],
    };
    const { set, added } = mergeImport(existing, imported, sanitizeHtml);
    expect(added).toBe(2);
    expect(set['absolute_note_https://a.com/'].map((n) => [n.id, n.text])).toEqual([
      ['1', 'mine'],
      ['2', 'ok'],
    ]);
    expect(set['absolute_note_https://b.com/'].map((n) => n.id)).toEqual(['3']);
    expect(Object.keys(set)).toHaveLength(2);
  });

  it('rewrites keys from older exports to the normalized page url', () => {
    const imported = {
      'absolute_note_https://a.com/doc#intro': [note('1')],
      'absolute_note_https://a.com/doc?utm_source=x': [note('2')],
    };
    const { set, added } = mergeImport({}, imported, sanitizeHtml);
    expect(added).toBe(2);
    expect(Object.keys(set)).toEqual(['absolute_note_https://a.com/doc']);
    expect(set['absolute_note_https://a.com/doc'].map((n) => n.id)).toEqual(['1', '2']);
  });

  it('accepts only plain objects as payload', () => {
    expect(isImportPayload({})).toBe(true);
    expect(isImportPayload([])).toBe(false);
    expect(isImportPayload(null)).toBe(false);
    expect(isImportPayload('x')).toBe(false);
  });
});

describe('planMigration', () => {
  it('moves notes to normalized keys, merging pages that differed only by anchor', () => {
    const all = {
      'absolute_note_https://a.com/doc': [note('1', { text: 'canonical' })],
      'absolute_note_https://a.com/doc#part-2': [note('1', { text: 'duplicate' }), { id: '2', text: 'old', posY_px: 400, h_px: 200 }],
      'absolute_note_https://b.com/#/route': [note('3')],
      'absolute_note_https://c.com/empty': [],
    };
    const { set, remove } = planMigration(all);
    expect(set['absolute_note_https://a.com/doc']).toEqual([
      note('1', { text: 'canonical' }),
      { id: '2', text: 'old', locked: false, colorIndex: 0, anchor: 'top', posX_px: 0, posY_px: 300, h_px: 200 },
    ]);
    expect(set['absolute_note_https://b.com/#/route']).toEqual([note('3')]);
    expect(remove.sort()).toEqual(['absolute_note_https://a.com/doc#part-2', 'absolute_note_https://c.com/empty']);
    expect(set.absolute_note_schema).toBe(SCHEMA_VERSION);
  });

  it('keeps only non-default per-page ui state, under normalized keys', () => {
    const all = {
      'absolute_note_outline_https://a.com/doc#x': 'visible',
      'absolute_note_outline_https://b.com/': 'hidden',
      'absolute_note_hide_https://a.com/doc': 'hidden',
      'absolute_note_hide_https://c.com/': 'visible',
      absolute_note_lang: 'es',
      absolute_note_settings: { width: 200 },
    };
    const { set, remove } = planMigration(all);
    expect(set).toEqual({
      'absolute_note_outline_https://a.com/doc': 'visible',
      'absolute_note_hide_https://a.com/doc': 'hidden',
      absolute_note_schema: SCHEMA_VERSION,
    });
    expect(remove.sort()).toEqual([
      'absolute_note_hide_https://c.com/',
      'absolute_note_outline_https://a.com/doc#x',
      'absolute_note_outline_https://b.com/',
    ]);
  });
});

describe('runMigrations', () => {
  it('migrates once and records the schema version', async () => {
    const fake = installFakeExt({ 'absolute_note_https://a.com/#top': [note('1')], absolute_note_lang: 'es' });
    await runMigrations();
    expect(fake.data).toEqual({
      'absolute_note_https://a.com/': [note('1')],
      absolute_note_lang: 'es',
      absolute_note_schema: SCHEMA_VERSION,
    });
    fake.data['absolute_note_https://a.com/#again'] = [note('2')];
    await runMigrations();
    expect(fake.data['absolute_note_https://a.com/#again']).toEqual([note('2')]);
  });
});
