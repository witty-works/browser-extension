/** A switch, or any wait for a check, ended by `destroy()`. */
export class EditorDestroyedError extends Error {
  constructor() {
    super('the editor was destroyed');
    this.name = 'EditorDestroyedError';
  }
}

/**
 * Callers waiting for the next complete check, such as a gender format switch.
 * A waiter is armed by the first check that starts after it began waiting, and
 * settled by that check's last batch (with whether part of the text stayed
 * unchecked), by a failed check, or by the editor's destruction; so a wait
 * always ends, provided checks do (the checker has a request timeout).
 */
export interface CheckWaiters {
  /** Resolves with `limitReached` once the next check has finished. */
  next(): Promise<boolean>;
  /** A check started: arms every waiter waiting so far. */
  started(): void;
  /** A check's last batch arrived: settles the armed waiters. */
  completed(limitReached: boolean): void;
  /** A check failed: rejects every waiter. */
  failed(error: unknown): void;
  /** The editor is gone: rejects every waiter, and any later one. */
  destroy(): void;
}

interface Waiter {
  armed: boolean;
  resolve: (limitReached: boolean) => void;
  reject: (error: unknown) => void;
}

export const createCheckWaiters = (): CheckWaiters => {
  const waiters = new Set<Waiter>();
  let destroyed = false;

  const rejectAll = (error: unknown): void => {
    waiters.forEach((waiter) => waiter.reject(error));
    waiters.clear();
  };

  return {
    next: (): Promise<boolean> =>
      new Promise((resolve, reject) => {
        if (destroyed) {
          reject(new EditorDestroyedError());
          return;
        }
        waiters.add({armed: false, resolve, reject});
      }),
    started: (): void => {
      waiters.forEach((waiter) => {
        waiter.armed = true;
      });
    },
    completed: (limitReached: boolean): void => {
      for (const waiter of waiters) {
        if (!waiter.armed) continue;
        waiter.resolve(limitReached);
        waiters.delete(waiter);
      }
    },
    failed: rejectAll,
    destroy: (): void => {
      destroyed = true;
      rejectAll(new EditorDestroyedError());
    },
  };
};
