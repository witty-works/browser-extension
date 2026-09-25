import {describe, expect, it} from 'vitest';

import {createCheckWaiters, EditorDestroyedError} from './checkWaiters';

describe('createCheckWaiters', () => {
  it('settles a waiter with the first check that starts after it', async () => {
    const waiters = createCheckWaiters();
    // A check already running when the wait began does not count.
    waiters.completed(false);
    const next = waiters.next();
    waiters.completed(true);
    waiters.started();
    waiters.completed(false);

    await expect(next).resolves.toBe(false);
  });

  it('rejects the waiters of a failed check', async () => {
    const waiters = createCheckWaiters();
    const next = waiters.next();
    waiters.started();
    const error = new Error('refused');

    waiters.failed(error);

    await expect(next).rejects.toBe(error);
  });

  it('ends every wait when the editor is destroyed, and refuses new ones', async () => {
    const waiters = createCheckWaiters();
    const pending = waiters.next();
    waiters.started();

    waiters.destroy();

    await expect(pending).rejects.toBeInstanceOf(EditorDestroyedError);
    await expect(waiters.next()).rejects.toBeInstanceOf(EditorDestroyedError);
  });
});
