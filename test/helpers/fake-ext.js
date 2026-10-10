// In-memory stand-in for the promise-based extension storage API. Every call resolves after a
// random delay so concurrent operations interleave the way they can in a real browser.
export function installFakeExt(initial = {}) {
  const data = structuredClone(initial);
  const listeners = new Set();
  const tick = () => new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
  const keysOf = (keys) => (keys == null ? Object.keys(data) : Array.isArray(keys) ? keys : [keys]);

  const emit = (changes) => {
    if (Object.keys(changes).length) listeners.forEach((fn) => fn(structuredClone(changes), 'local'));
  };

  const local = {
    async get(keys) {
      await tick();
      const result = {};
      for (const key of keysOf(keys)) if (key in data) result[key] = structuredClone(data[key]);
      return result;
    },
    async set(items) {
      await tick();
      const changes = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: data[key], newValue: structuredClone(value) };
        data[key] = structuredClone(value);
      }
      emit(changes);
    },
    async remove(keys) {
      await tick();
      const changes = {};
      for (const key of keysOf(keys)) {
        if (key in data) changes[key] = { oldValue: data[key] };
        delete data[key];
      }
      emit(changes);
    },
  };

  globalThis.chrome = {
    runtime: { id: 'test' },
    storage: {
      local,
      onChanged: { addListener: (fn) => listeners.add(fn), removeListener: (fn) => listeners.delete(fn) },
    },
  };
  return { data };
}
