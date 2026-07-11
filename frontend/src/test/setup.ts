import '@testing-library/jest-dom';

/**
 * Node 26 adds an experimental globalThis.localStorage getter that returns undefined
 * unless --localstorage-file is provided. This conflicts with happy-dom/jsdom environments.
 * We provide a simple in-memory localStorage implementation for tests.
 */
function createLocalStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string): void {
      store[key] = String(value);
    },
    removeItem(key: string): void {
      delete store[key];
    },
    clear(): void {
      store = {};
    },
    get length(): number {
      return Object.keys(store).length;
    },
    key(index: number): string | null {
      return Object.keys(store)[index] ?? null;
    },
  };
}

const storage = createLocalStorage();

Object.defineProperty(globalThis, 'localStorage', {
  value: storage,
  writable: true,
  configurable: true,
});

Object.defineProperty(window, 'localStorage', {
  value: storage,
  writable: true,
  configurable: true,
});
