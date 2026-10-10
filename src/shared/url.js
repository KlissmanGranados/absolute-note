const TRACKING_PARAM = /^(utm_\w+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|_ga|_gl)$/i;

// Hash-based SPA routes ("#/inbox", "#!/inbox") identify a page; plain fragments ("#section") don't.
function isRouteHash(hash) {
  return /^#!?\//.test(hash);
}

function paramName(part) {
  const name = part.split('=')[0].replace(/\+/g, ' ');
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

// The page identity notes are stored under: the URL without in-page anchors or tracking parameters,
// so following "#section" links or arriving from a campaign link keeps the same notes.
export function normalizePageUrl(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  if (!/^(https?|file):$/.test(url.protocol)) return href;

  if (!isRouteHash(url.hash)) url.hash = '';

  // The query is filtered as text rather than through url.searchParams: it keeps the remaining
  // parameters' encoding untouched, and searchParams iterators can't be used from Firefox content
  // scripts (they are page objects seen through Xray wrappers).
  if (url.search) {
    const parts = url.search.slice(1).split('&');
    const kept = parts.filter((part) => !TRACKING_PARAM.test(paramName(part)));
    if (kept.length !== parts.length) url.search = kept.length ? '?' + kept.join('&') : '';
  }
  return url.href;
}
