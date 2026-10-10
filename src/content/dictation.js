// Voice-to-text for the note editor, on top of the browser's Web Speech API (SpeechRecognition).
// Chrome has it (audio is processed by the browser vendor's speech service); Firefox doesn't ship
// it, so callers hide the dictation button when `supported` is false.
// The microphone permission is the page's own: the browser asks the user per site on first use.

const LANG_TAGS = { en: 'en-US', es: 'es-ES' };
// Errors after which retrying can't succeed without the user changing something.
const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported']);
const MAX_SILENT_RESTARTS = 5;

export function speechLangTag(lang) {
  return LANG_TAGS[lang] || LANG_TAGS.en;
}

export function getRecognitionCtor() {
  return globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;
}

// Continuous dictation. Chrome ends a recognition session after a stretch of silence, so while the
// user hasn't stopped it, the session is restarted. Callbacks:
//   onText(text)    a finished phrase, trimmed
//   onState(bool)   listening started/stopped
//   onError(code)   a SpeechRecognition error code ('not-allowed', 'network', …)
export class Dictation {
  constructor({ lang, onText, onState, onError, Ctor = getRecognitionCtor() }) {
    this.lang = lang;
    this.onText = onText;
    this.onState = onState;
    this.onError = onError;
    this.Ctor = Ctor;
    this.recognition = null;
    this.wanted = false;
    this.silentRestarts = 0;
  }

  get supported() {
    return !!this.Ctor;
  }

  get listening() {
    return this.wanted;
  }

  start() {
    if (!this.Ctor || this.wanted) return;
    this.wanted = true;
    this.silentRestarts = 0;
    this.launch();
  }

  // `abort` drops audio still being processed (used when the editor closes); a plain stop lets the
  // last phrase arrive.
  stop({ abort = false } = {}) {
    if (!this.wanted) return;
    this.wanted = false;
    const recognition = this.recognition;
    this.recognition = null;
    if (recognition) {
      recognition.onend = null;
      recognition.onerror = null;
      if (abort) recognition.onresult = null;
      try {
        if (abort) recognition.abort();
        else recognition.stop();
      } catch {
        // Already stopped.
      }
    }
    this.onState(false);
  }

  toggle() {
    if (this.wanted) this.stop();
    else this.start();
  }

  launch() {
    let recognition;
    try {
      recognition = new this.Ctor();
    } catch {
      this.fail('unsupported');
      return;
    }
    recognition.lang = speechLangTag(this.lang);
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onstart = () => this.onState(true);
    recognition.onresult = (event) => {
      this.silentRestarts = 0;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const text = result[0].transcript.trim();
        if (text) this.onText(text);
      }
    };
    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (FATAL_ERRORS.has(event.error)) this.fail(event.error);
      else this.onError(event.error);
    };
    recognition.onend = () => {
      if (!this.wanted || this.recognition !== recognition) return;
      // Ended by itself (silence, network hiccup): keep listening, unless it keeps ending at once.
      if (++this.silentRestarts > MAX_SILENT_RESTARTS) {
        this.fail('network');
        return;
      }
      this.launch();
    };
    this.recognition = recognition;
    try {
      recognition.start();
    } catch {
      this.fail('unsupported');
    }
  }

  fail(code) {
    this.wanted = false;
    this.recognition = null;
    this.onState(false);
    this.onError(code);
  }
}

// Inserts dictated text at the caret of a contentEditable, keeping words apart.
export function insertDictatedText(body, text, savedRange) {
  const sel = window.getSelection();
  if (!sel.rangeCount || !body.contains(sel.anchorNode)) {
    body.focus();
    sel.removeAllRanges();
    if (savedRange && body.contains(savedRange.startContainer)) {
      sel.addRange(savedRange);
    } else {
      const end = document.createRange();
      end.selectNodeContents(body);
      end.collapse(false);
      sel.addRange(end);
    }
  }
  const before = document.createRange();
  before.selectNodeContents(body);
  before.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
  const previous = before.toString().slice(-1);
  const needsSpace = previous && !/\s/.test(previous) && !/^\s/.test(text);
  document.execCommand('insertText', false, (needsSpace ? ' ' : '') + text);
}
