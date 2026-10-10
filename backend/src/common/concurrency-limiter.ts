export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

/**
 * Minimal counting semaphore: at most `concurrency` tasks run at once, the rest
 * wait in FIFO order. Used to keep parallel DB transactions below the pool size.
 */
export function createLimiter(concurrency: number): Limiter {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`concurrency must be a positive integer, got ${concurrency}`);
  }
  let active = 0;
  const queue: Array<() => void> = [];

  // The slot is handed directly to the next waiter, otherwise a new caller could
  // grab it in the gap before the waiter resumes and exceed `concurrency`.
  const release = () => {
    const next = queue.shift();
    if (next) next();
    else active--;
  };

  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    } else {
      active++;
    }
    try {
      return await task();
    } finally {
      release();
    }
  };
}
