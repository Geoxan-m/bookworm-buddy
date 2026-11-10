import type { Book } from "./books";
import { dedupeBooks } from "./searchBooks";

/** Merge batches in priority order (earlier batch wins), deduped, capped. */
export function mergeOrderedBatches(batches: Book[][], limit = Infinity): Book[] {
  return dedupeBooks(batches.flat()).slice(0, limit);
}

export type SearchSource = {
  run: (signal: AbortSignal) => Promise<Book[]>;
};

/**
 * Runs all sources in parallel. Each time one settles, calls onUpdate with the
 * merged results so far, always ordered by source priority (index order), so
 * later arrivals never reshuffle higher-priority results. Stale runs (aborted
 * signal) never call onUpdate. Resolves with the final merged list.
 */
export async function progressiveSearch(
  sources: SearchSource[],
  signal: AbortSignal,
  onUpdate: (books: Book[], done: boolean) => void,
): Promise<Book[]> {
  const results: Book[][] = sources.map(() => []);
  let pending = sources.length;
  let last: Book[] = [];
  await Promise.all(
    sources.map(async (s, i) => {
      try {
        results[i] = await s.run(signal);
      } catch {
        results[i] = [];
      }
      pending--;
      if (signal.aborted) return;
      last = mergeOrderedBatches(results);
      onUpdate(last, pending === 0);
    }),
  );
  return last;
}
