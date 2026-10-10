import { describe, expect, it } from 'vitest';
import { countWords, htmlToText } from '../src/shared/text.js';

describe('countWords', () => {
  it('counts plain words', () => {
    expect(countWords('uno dos  tres\n cuatro')).toBe(4);
  });
  it('is zero for empty content', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('<p><br></p>')).toBe(0);
    expect(countWords(null)).toBe(0);
  });
  it('separates words across line breaks and blocks', () => {
    expect(countWords('uno<br>dos')).toBe(2);
    expect(countWords('<div>uno</div><div>dos</div>')).toBe(2);
    expect(countWords('uno dos tres<div>cuatro</div>')).toBe(4);
    expect(countWords('uno<div>dos</div>tres')).toBe(3);
    expect(countWords('<ul><li>uno</li><li>dos tres</li></ul>')).toBe(3);
  });
  it('does not split words on inline formatting', () => {
    expect(countWords('hel<b>lo</b> wor<i>ld</i>')).toBe(2);
  });
  it('ignores markup and entities', () => {
    expect(countWords('<span style="font-size: 18px">hola</span> &amp; adiós')).toBe(3);
  });
});

describe('htmlToText', () => {
  it('keeps lines apart and collapses whitespace', () => {
    expect(htmlToText('uno dos tres<div>cuatro</div>')).toBe('uno dos tres cuatro');
    expect(htmlToText('a<br><br>b')).toBe('a b');
  });
});
