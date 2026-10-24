/**
 * Runs `worker` over `items` with at most `limit` concurrent executions.
 *
 * Intentionally dependency-free (no p-limit/p-queue) — a small worker
 * pool is enough for our use case: capping how many Chromium pages we
 * have open at once during batch PDF generation so a subject/class
 * with dozens of chapters doesn't try to render everything at the same
 * time and overwhelm the machine.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);

  if (!items.length) {
    return results;
  }

  const poolSize = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  async function runNext(): Promise<void> {
    const current = cursor;
    cursor += 1;

    if (current >= items.length) {
      return;
    }

    results[current] = await worker(items[current], current);

    return runNext();
  }

  await Promise.all(Array.from({ length: poolSize }, () => runNext()));

  return results;
}
