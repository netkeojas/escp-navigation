/**
 * Storage access that cannot throw.
 *
 * Safari in private browsing throws on localStorage.setItem, and neither store
 * exists when this code is rendered outside a browser. Losing a cached snapshot
 * or a remembered origin is never worth taking the page down with it.
 */

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const store = {
  get(key: string): string | null {
    return safe(() => globalThis.localStorage?.getItem(key) ?? null, null);
  },
  set(key: string, value: string): void {
    safe(() => globalThis.localStorage?.setItem(key, value), undefined);
  },
  session: {
    get(key: string): string | null {
      return safe(() => globalThis.sessionStorage?.getItem(key) ?? null, null);
    },
    set(key: string, value: string): void {
      safe(() => globalThis.sessionStorage?.setItem(key, value), undefined);
    },
  },
};
