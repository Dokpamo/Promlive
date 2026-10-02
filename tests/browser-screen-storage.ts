/** Isolated browser stores and the exclusive Web Locks contract used by jsdom tests. */
export function browserStore(): Storage {
  const values = new Map<string, string>();
  return {get length() {return values.size;}, key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null, setItem: (key, value) => {values.set(key, value);},
    removeItem: key => {values.delete(key);}, clear: () => values.clear()};
}
export function installBrowserScreenStorage() {
  Object.defineProperty(window, 'localStorage', {configurable: true, value: browserStore()});
  Object.defineProperty(window, 'sessionStorage', {configurable: true, value: browserStore()});
  const pending = new Map<string, Promise<unknown>>();
  Object.defineProperty(navigator, 'locks', {configurable: true, value: {
    request(name: string, callback: () => unknown) {
      const result = (pending.get(name) ?? Promise.resolve()).then(callback);
      pending.set(name, result.catch(() => {}));
      return result;
    },
  }});
}
