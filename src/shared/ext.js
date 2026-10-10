// Firefox exposes the promise-based `browser` namespace; in Chrome MV3 `chrome` returns promises too,
// so every caller can use the promise form regardless of the browser.
export function ext() {
  return globalThis.browser ?? globalThis.chrome;
}

// After the extension is reloaded or updated, content scripts already injected keep running but
// every extension API call throws. This tells them apart.
export function isContextAlive() {
  try {
    return !!ext()?.runtime?.id;
  } catch {
    return false;
  }
}
