import { describe, expect, it } from 'vitest';
import { normalizePageUrl } from '../src/shared/url.js';

describe('normalizePageUrl', () => {
  it('drops in-page anchors', () => {
    expect(normalizePageUrl('https://example.com/docs/page#section-2')).toBe('https://example.com/docs/page');
    expect(normalizePageUrl('https://example.com/docs/page#')).toBe('https://example.com/docs/page');
  });

  it('keeps hash-based SPA routes', () => {
    expect(normalizePageUrl('https://app.example.com/#/inbox/42')).toBe('https://app.example.com/#/inbox/42');
    expect(normalizePageUrl('https://app.example.com/#!/inbox')).toBe('https://app.example.com/#!/inbox');
  });

  it('drops tracking parameters and keeps the rest untouched', () => {
    expect(normalizePageUrl('https://example.com/a?id=7&utm_source=x&utm_medium=y&fbclid=z')).toBe(
      'https://example.com/a?id=7',
    );
    expect(normalizePageUrl('https://example.com/a?utm_campaign=x')).toBe('https://example.com/a');
  });

  it('keeps the encoding of the remaining parameters when dropping tracking ones', () => {
    expect(normalizePageUrl('https://example.com/a?q=a%20b+c&utm_source=x&tag=%C3%B1')).toBe(
      'https://example.com/a?q=a%20b+c&tag=%C3%B1',
    );
  });

  it('does not re-encode queries without tracking parameters', () => {
    const href = 'https://example.com/search?q=a%20b&tag=x+y';
    expect(normalizePageUrl(href)).toBe(href);
  });

  it('leaves non-web and unparsable URLs alone', () => {
    expect(normalizePageUrl('about:blank')).toBe('about:blank');
    expect(normalizePageUrl('not a url')).toBe('not a url');
  });

  it('is idempotent', () => {
    const once = normalizePageUrl('https://example.com/p?a=1&utm_source=x#top');
    expect(normalizePageUrl(once)).toBe(once);
  });
});
