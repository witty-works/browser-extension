/**
 * Storage adapter (EDITOR_COMPONENT_PLAN.md, Phase 1 item 2).
 *
 * `shared/` code only ever does three things with `browser.storage`: read and
 * write `local`, read and write `session` (falling back to `local` on
 * browsers that predate it — see tokenStore.ts), and listen for changes.
 * `WittyStorage` is exactly that surface, injected once at each bundle's
 * entry point via `registerStorage`, so `shared/` stops importing
 * webextension-polyfill directly. A future `<witty-editor>` consumer can
 * register a `localStorage`/in-memory implementation instead of a
 * browser-extension one.
 */

export interface StorageArea {
  get(
    keys?: string | string[] | Record<string, unknown> | null
  ): Promise<Record<string, any>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export type StorageChange = Record<
  string,
  {oldValue?: unknown; newValue?: unknown}
>;

export interface WittyStorage {
  local: StorageArea;
  /**
   * Absent on browsers older than Chrome 102 / Firefox 115. Callers that need
   * it fall back to `local` — see `tokenStore.ts`'s `sessionArea()`.
   */
  session?: StorageArea;
  onChanged: {
    addListener(callback: (changes: StorageChange) => void): void;
    removeListener(callback: (changes: StorageChange) => void): void;
  };
}

let storage: WittyStorage | null = null;

/**
 * Register the storage implementation `getStorage()` delegates to. Call once,
 * at bundle start-up (Background, ContentScript, Popup, Options each do this
 * for themselves — every bundle is its own JS context).
 */
export const registerStorage = (impl: WittyStorage): void => {
  storage = impl;
};

/** The registered storage implementation. Throws if none was registered yet. */
export const getStorage = (): WittyStorage => {
  if (!storage) {
    throw new Error(
      'getStorage() called before registerStorage() — register a WittyStorage implementation at bundle start-up (see webextensionStorage.ts).'
    );
  }

  return storage;
};
