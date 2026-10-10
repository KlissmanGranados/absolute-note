import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dictation, insertDictatedText, speechLangTag } from '../src/content/dictation.js';

class FakeRecognition {
  static instances = [];
  constructor() {
    FakeRecognition.instances.push(this);
    this.started = false;
  }
  start() { this.started = true; this.onstart && this.onstart(); }
  stop() { this.started = false; }
  abort() { this.started = false; }
  say(text, isFinal = true) {
    this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal })] });
  }
}

function make(overrides = {}) {
  const log = { text: [], state: [], error: [] };
  const dictation = new Dictation({
    lang: 'es',
    onText: (t) => log.text.push(t),
    onState: (s) => log.state.push(s),
    onError: (e) => log.error.push(e),
    Ctor: FakeRecognition,
    ...overrides,
  });
  return { dictation, log, current: () => FakeRecognition.instances.at(-1) };
}

beforeEach(() => {
  FakeRecognition.instances = [];
});

describe('Dictation', () => {
  it('is unsupported without a SpeechRecognition constructor', () => {
    const { dictation } = make({ Ctor: null });
    expect(dictation.supported).toBe(false);
    dictation.start();
    expect(dictation.listening).toBe(false);
  });

  it('listens continuously in the extension language', () => {
    const { dictation, log, current } = make();
    dictation.start();
    expect(current().lang).toBe('es-ES');
    expect(current().continuous).toBe(true);
    expect(log.state).toEqual([true]);
    expect(speechLangTag('en')).toBe('en-US');
    expect(speechLangTag('xx')).toBe('en-US');
  });

  it('delivers only finished phrases, trimmed', () => {
    const { dictation, log, current } = make();
    dictation.start();
    current().say('hola', false);
    current().say('  hola mundo ');
    current().say('   ');
    expect(log.text).toEqual(['hola mundo']);
  });

  it('keeps listening after the browser ends a session', () => {
    const { dictation, log, current } = make();
    dictation.start();
    const first = current();
    first.onend();
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(current().started).toBe(true);
    expect(dictation.listening).toBe(true);
    expect(log.error).toEqual([]);
  });

  it('gives up when sessions keep ending without any speech', () => {
    const { dictation, log, current } = make();
    dictation.start();
    for (let i = 0; i < 10 && dictation.listening; i++) current().onend();
    expect(dictation.listening).toBe(false);
    expect(log.error).toEqual(['network']);
    expect(log.state.at(-1)).toBe(false);
  });

  it('stops for good on a denied microphone and reports it', () => {
    const { dictation, log, current } = make();
    dictation.start();
    current().onerror({ error: 'not-allowed' });
    expect(dictation.listening).toBe(false);
    expect(log.error).toEqual(['not-allowed']);
    expect(log.state).toEqual([true, false]);
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it('ignores silence errors', () => {
    const { dictation, log, current } = make();
    dictation.start();
    current().onerror({ error: 'no-speech' });
    expect(dictation.listening).toBe(true);
    expect(log.error).toEqual([]);
  });

  it('does not restart after being stopped, and abort drops pending results', () => {
    const { dictation, log, current } = make();
    dictation.start();
    const rec = current();
    dictation.stop({ abort: true });
    expect(rec.started).toBe(false);
    expect(rec.onresult).toBeNull();
    expect(log.state).toEqual([true, false]);
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it('toggles', () => {
    const { dictation } = make();
    dictation.toggle();
    expect(dictation.listening).toBe(true);
    dictation.toggle();
    expect(dictation.listening).toBe(false);
  });
});

describe('insertDictatedText', () => {
  let body;
  let inserted;
  beforeEach(() => {
    document.body.innerHTML = '<div id="b" contenteditable="true"></div>';
    body = document.getElementById('b');
    inserted = [];
    document.execCommand = vi.fn((_, __, text) => inserted.push(text));
    body.focus = () => {};
  });
  const caretAtEnd = () => {
    const range = document.createRange();
    range.selectNodeContents(body);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  it('inserts at the end when the editor has no selection yet', () => {
    body.textContent = 'hola';
    window.getSelection().removeAllRanges();
    insertDictatedText(body, 'mundo', null);
    expect(inserted).toEqual([' mundo']);
  });

  it('adds no space at the start or after whitespace', () => {
    caretAtEnd();
    insertDictatedText(body, 'hola', null);
    body.textContent = 'hola ';
    caretAtEnd();
    insertDictatedText(body, 'mundo', null);
    expect(inserted).toEqual(['hola', 'mundo']);
  });

  it('restores the saved caret when focus was elsewhere', () => {
    body.textContent = 'abc def';
    const saved = document.createRange();
    saved.setStart(body.firstChild, 3);
    saved.collapse(true);
    window.getSelection().removeAllRanges();
    insertDictatedText(body, 'xyz', saved);
    expect(inserted).toEqual([' xyz']);
    expect(window.getSelection().anchorOffset).toBe(3);
  });
});
