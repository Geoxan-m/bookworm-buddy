import { phraseAliases, rankBooks } from "./searchRank";
import type { Book } from "./books";
import {
  editionKey,
  normalizeLanguage,
  normalizeSeriesTitle,
  parseSeriesNumber,
  validYear,
  workKey,
} from "./workIdentity";
import { cleanAuthor } from "./externalMappers";
import { bookKey, normalizeGreek, normalizeIsbn, stripLeadingArticle } from "./greekNormalize";

export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_CATALOG_RESULTS = 20;
export const MAX_UPSERT = 30;
export const MAX_CATALOG_CANDIDATES = 60;

/** Only normalized letters/numbers enter PostgREST grammar; bounded OR predicates. */
export function catalogCandidateFilter(query: string): string {
  if (/^[\d\s\-xX]+$/.test(query.trim()) && normalizeIsbn(query))
    return `isbn_norm.eq.${normalizeIsbn(query)}`;
  const variants = phraseAliases(query).map((q) => q.split(" "));
  const tokens = [
    ...new Set(
      Array.from({ length: 8 }, (_, i) => variants.flatMap((v) => (v[i] ? [v[i]] : []))).flat(),
    ),
  ].slice(0, 8);
  return tokens.flatMap((t) => [`title_norm.ilike.%${t}%`, `author_norm.ilike.%${t}%`]).join(",");
}

export type CatalogRow = {
  dedupe_key: string;
  isbn_norm: string | null;
  title: string;
  title_norm: string;
  author: string;
  author_norm: string;
  genre: string;
  cover_url: string;
  description: string;
  source: string;
  source_id: string | null;
  source_url: string | null;
  last_validated_at?: string;
  // Optional work/edition/series metadata (absent on legacy rows).
  work_key?: string | null;
  edition_key?: string | null;
  series_title?: string | null;
  series_title_norm?: string | null;
  series_number?: number | null;
  publisher?: string | null;
  published_year?: number | null;
  language_code?: string | null;
};

export function isValidBook(b: Partial<Book> | null | undefined): b is Book {
  if (!b || typeof b.title !== "string") return false;
  const t = b.title.trim();
  if (t.length < 1 || t.length > 300) return false;
  if (b.coverUrl && !/^https:\/\//.test(b.coverUrl)) return false;
  return true;
}

export function toRow(input: Book, source: string, sourceUrl?: string): CatalogRow {
  // Placeholder authors ("Unknown", "-", …) are stored as empty, never as metadata.
  const b: Book = { ...input, author: cleanAuthor(input.author) };
  const isbn = normalizeIsbn(b.isbn || "");
  const series = (b.series || "").trim();
  const id = {
    isbn: b.isbn,
    title: b.title,
    author: b.author,
    publisher: b.publisher,
    publishedYear: validYear(b.publishedYear),
    languageCode: normalizeLanguage(b.languageCode),
  };
  return {
    dedupe_key: bookKey(b),
    isbn_norm: isbn || null,
    title: b.title.trim(),
    title_norm: stripLeadingArticle(normalizeGreek(b.title)),
    author: (b.author || "").trim(),
    author_norm: normalizeGreek(b.author || ""),
    genre: b.genre || "",
    cover_url: b.coverUrl || "",
    description: (b.description || "").slice(0, 4000),
    source,
    source_id: b.id || null,
    source_url: sourceUrl ?? null,
    work_key: workKey(id),
    edition_key: editionKey(id),
    series_title: series || null,
    series_title_norm: normalizeSeriesTitle(series),
    series_number: series ? parseSeriesNumber(b.seriesNumber ?? null) : null,
    publisher: (b.publisher || "").trim() || null,
    published_year: id.publishedYear,
    language_code: id.languageCode,
  };
}

export function fromRow(r: CatalogRow): Book {
  return {
    id: r.source_id || r.dedupe_key,
    isbn: r.isbn_norm || "",
    title: r.title,
    author: cleanAuthor(r.author),
    genre: r.genre,
    coverUrl: r.cover_url,
    description: r.description,
    ...(r.series_title ? { series: r.series_title } : {}),
    ...(r.series_number != null ? { seriesNumber: Number(r.series_number) } : {}),
    ...(r.publisher ? { publisher: r.publisher } : {}),
    ...(r.published_year != null ? { publishedYear: r.published_year } : {}),
    ...(r.language_code ? { languageCode: r.language_code } : {}),
  };
}

/** Never replace non-empty existing metadata with empty incoming values. */
export function mergeRow(existing: CatalogRow | undefined, incoming: CatalogRow): CatalogRow {
  if (!existing) return incoming;
  const pick = <K extends keyof CatalogRow>(k: K) =>
    (incoming[k] as unknown) ? incoming[k] : existing[k];
  const desc =
    incoming.description.length > existing.description.length
      ? incoming.description
      : existing.description;
  return {
    ...existing,
    isbn_norm: pick("isbn_norm"),
    title: pick("title"),
    author: pick("author"),
    author_norm: pick("author_norm"),
    genre: pick("genre"),
    cover_url: pick("cover_url"),
    description: desc,
    source_url: pick("source_url"),
    work_key: pick("work_key") ?? null,
    edition_key: pick("edition_key") ?? null,
    series_title: pick("series_title") ?? null,
    series_title_norm: pick("series_title_norm") ?? null,
    series_number: pick("series_number") ?? null,
    publisher: pick("publisher") ?? null,
    published_year: pick("published_year") ?? null,
    language_code: pick("language_code") ?? null,
  };
}

/** Dedupe rows by key (ISBN first via bookKey), merging metadata. */
export function dedupeRows(rows: CatalogRow[]): CatalogRow[] {
  const m = new Map<string, CatalogRow>();
  for (const r of rows) m.set(r.dedupe_key, mergeRow(m.get(r.dedupe_key), r));
  return [...m.values()];
}

export function isFresh(
  fetchedAt: string | null | undefined,
  now = Date.now(),
  ttl = CACHE_TTL_MS,
) {
  if (!fetchedAt) return false;
  const t = Date.parse(fetchedAt);
  return Number.isFinite(t) && now - t < ttl;
}

export type CatalogDeps = {
  readCache: (q: string) => Promise<{ fetched_at: string; result_keys?: string[] } | null>;
  readByKeys?: (keys: string[]) => Promise<CatalogRow[]>;
  readCatalog: (q: string) => Promise<CatalogRow[]>;
  fetchExternal: (q: string) => Promise<Book[]>;
  write: (q: string, rows: CatalogRow[]) => Promise<void>;
  now?: () => number;
};

/**
 * Local-first: returns catalogue hits; on miss/stale queries external source,
 * upserts valid results. External failure falls back to local results.
 */
export type CachedSearchOptions = {
  /** Fixed catalogue source, or per-book source resolver (e.g. Google vs Open Library). */
  source?: string | ((b: Book) => string);
  /** Cache-key namespace, e.g. "intl" → "intl:<query>". Biblionet keeps un-prefixed keys. */
  namespace?: string;
};

/** Namespaced search_cache key; namespaces never collide with un-prefixed Biblionet keys. */
export function cacheKeyFor(query: string, namespace?: string): string {
  const q = normalizeGreek(query);
  return namespace ? `${namespace}:${q}` : q;
}

export async function cachedSearch(
  query: string,
  deps: CatalogDeps,
  opts: string | CachedSearchOptions = "biblionet",
) {
  const o = typeof opts === "string" ? { source: opts } : opts;
  const sourceOf =
    typeof o.source === "function" ? o.source : () => (o.source as string) ?? "biblionet";
  const q = normalizeGreek(query);
  const key = cacheKeyFor(query, o.namespace);
  const [cache, local] = await Promise.all([
    deps.readCache(key).catch(() => null),
    deps.readCatalog(q).catch(() => [] as CatalogRow[]),
  ]);
  const localBooks = rankBooks(query, local.map(fromRow), MAX_CATALOG_RESULTS);
  if (
    cache &&
    isFresh(cache.fetched_at, deps.now?.()) &&
    cache.result_keys?.length &&
    deps.readByKeys
  ) {
    const keys = [...new Set(cache.result_keys)].slice(0, MAX_UPSERT);
    const restored = await deps.readByKeys(keys).catch(() => [] as CatalogRow[]);
    const byKey = new Map(restored.map((r) => [r.dedupe_key, r]));
    if (keys.every((k) => byKey.has(k))) {
      const books = rankBooks(
        query,
        keys.flatMap((k) => {
          const r = byKey.get(k);
          return r ? [fromRow(r)] : [];
        }),
        MAX_CATALOG_RESULTS,
      );
      if (books.length) return { books, cache: "hit" as const };
    }
  }
  let external: Book[] = [];
  try {
    external = await deps.fetchExternal(query);
  } catch {
    return { books: localBooks, cache: "error" as const };
  }
  const rows = dedupeRows(external.filter(isValidBook).map((b) => toRow(b, sourceOf(b)))).slice(
    0,
    MAX_UPSERT,
  );
  const existing = new Map(local.map((r) => [r.dedupe_key, r]));
  const merged = rows.map((r) => mergeRow(existing.get(r.dedupe_key), r));
  await deps.write(key, merged).catch(() => undefined);
  const popularity = new Map(external.map((b) => [bookKey(b), b.popularity]));
  const all = rankBooks(
    query,
    dedupeRows([...merged, ...local]).map((r) => {
      const b = fromRow(r);
      const pop = popularity.get(r.dedupe_key);
      return pop === undefined ? b : { ...b, popularity: pop };
    }),
    MAX_CATALOG_RESULTS,
  );
  return { books: all, cache: cache ? ("stale" as const) : ("miss" as const) };
}
