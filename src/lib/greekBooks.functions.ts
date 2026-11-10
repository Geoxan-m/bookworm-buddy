import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { searchGreekBibliography } from "@/lib/greekBooks.server";
import { parseExternalRef } from "@/lib/externalMappers";
import {
  cachedSearch,
  catalogCandidateFilter,
  MAX_CATALOG_CANDIDATES,
  fromRow,
  isFresh,
  mergeRow,
  toRow,
  type CatalogDeps,
  type CatalogRow,
} from "@/lib/catalog";
import type { Book } from "@/lib/books";
import { rankBooks } from "@/lib/searchRank";
import { allowed, clientTag, rulesFor, type HitFn } from "@/lib/rateLimit";

type AdminDb = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Server-derived guard: client tag comes from the edge-set connecting IP, not request data. */
async function guard(db: AdminDb, kind: "external" | "intl" | "write"): Promise<boolean> {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const tag = await clientTag(getRequestHeader("cf-connecting-ip"));
  const hit: HitFn = async (r) => {
    const { data, error } = await db.rpc("rate_limit_hit", {
      _bucket: r.bucket,
      _max: r.max,
      _window_seconds: r.windowSeconds,
    });
    if (error) throw error;
    return data === true;
  };
  return allowed(rulesFor(kind, tag), hit);
}

/** search_cache + book_catalog access via the server-only admin client. */
function dbDeps(db: AdminDb, fetchExternal: (q: string) => Promise<Book[]>): CatalogDeps {
  return {
    readCache: async (key) => {
      const { data: row } = await db
        .from("search_cache")
        .select("fetched_at,result_keys")
        .eq("query_norm", key)
        .maybeSingle();
      return row;
    },
    readByKeys: async (keys) => {
      const { data, error } = await db
        .from("book_catalog")
        .select("*")
        .in("dedupe_key", keys.slice(0, 30));
      if (error) throw error;
      return (data ?? []) as CatalogRow[];
    },
    readCatalog: async (q) => {
      const t = catalogCandidateFilter(q);
      if (!t) return [];
      const { data: rows } = await db
        .from("book_catalog")
        .select("*")
        .or(t)
        .limit(MAX_CATALOG_CANDIDATES);
      return (rows ?? []) as CatalogRow[];
    },
    fetchExternal,
    write: async (key, rows) => {
      const now = new Date().toISOString();
      if (rows.length) {
        const { data: existing, error: readError } = await db
          .from("book_catalog")
          .select("*")
          .in(
            "dedupe_key",
            rows.map((r) => r.dedupe_key),
          );
        if (readError) throw readError;
        const byKey = new Map(((existing ?? []) as CatalogRow[]).map((r) => [r.dedupe_key, r]));
        const { error } = await db.from("book_catalog").upsert(
          rows.map((r) => ({ ...mergeRow(byKey.get(r.dedupe_key), r), last_validated_at: now })),
          { onConflict: "dedupe_key" },
        );
        if (error) throw error;
      }
      const { error } = await db.from("search_cache").upsert({
        query_norm: key,
        result_keys: rows.map((r) => r.dedupe_key),
        fetched_at: now,
      });
      if (error) throw error;
    },
  };
}

/** Catalogue source label for a provider book (IDs are minted server-side by the mappers). */
export function providerSource(b: Book): string {
  return b.id.startsWith("gb:") ? "google" : "openlibrary";
}

const InputSchema = z.object({
  query: z.string().min(3).max(160),
  limit: z.number().min(1).max(20).default(12),
});

export const getGreekBookResults = createServerFn({ method: "GET" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    let admin:
      | Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"]
      | null = null;
    try {
      admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    } catch {
      admin = null;
    }
    if (!admin) return { books: await searchGreekBibliography(data.query, data.limit) };
    const db = admin;
    const res = await cachedSearch(
      data.query,
      dbDeps(db, async (q) => {
        // Rate-limited: a denied request throws, so cachedSearch returns local results.
        if (!(await guard(db, "external"))) throw new Error("rate_limited");
        return searchGreekBibliography(q, data.limit);
      }),
    );
    return { books: res.books.slice(0, data.limit) };
  });

/**
 * Google Books + Open Library, server-side only. Local catalogue first; a fresh
 * "intl:<query>" cache entry returns catalogue rows with zero provider calls.
 */
// Same bounds, but 2-char numeric queries ("50") are allowed, matching allowsExternal.
const IntlInputSchema = InputSchema.extend({ query: z.string().min(2).max(160) });

export const getInternationalBookResults = createServerFn({ method: "GET" })
  .inputValidator((input) => IntlInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { searchInternational } = await import("@/lib/intlBooks.server");
    let db: AdminDb;
    try {
      db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    } catch {
      return { books: [] as Book[] };
    }
    const res = await cachedSearch(
      data.query,
      dbDeps(db, async (q) => {
        if (!(await guard(db, "intl"))) throw new Error("rate_limited");
        return searchInternational(q, data.limit);
      }),
      { source: providerSource, namespace: "intl" },
    );
    return { books: res.books.slice(0, data.limit) };
  });

/** Fast local-first read: saved catalogue matches only, no external requests. Read-only. */
export const getCatalogMatches = createServerFn({ method: "GET" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return { books: [] };
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const filter = catalogCandidateFilter(data.query);
    if (!filter) return { books: [] };
    const { data: rows } = await db
      .from("book_catalog")
      .select("*")
      .or(filter)
      .limit(MAX_CATALOG_CANDIDATES);
    return {
      books: rankBooks(data.query, ((rows ?? []) as CatalogRow[]).map(fromRow), data.limit),
    };
  });

/**
 * Saves one Google Books / Open Library record to the catalogue. The browser sends only a
 * source + ID; the server re-fetches from the source's own origin and validates everything.
 */
export const saveExternalBook = createServerFn({ method: "POST" })
  .inputValidator((input) => {
    const ref = parseExternalRef(input);
    if (!ref) throw new Error("Invalid reference");
    return ref;
  })
  .handler(async ({ data }) => {
    let db: AdminDb;
    try {
      db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    } catch {
      return { saved: false };
    }
    // Skip the re-fetch when this exact source record was validated within the TTL.
    const sourceId = data.source === "google" ? `gb:${data.id}` : data.id;
    const { data: fresh } = await db
      .from("book_catalog")
      .select("last_validated_at")
      .eq("source", data.source)
      .eq("source_id", sourceId)
      .limit(1)
      .maybeSingle();
    if (fresh && isFresh(fresh.last_validated_at)) return { saved: true, cached: true };
    if (!(await guard(db, "write"))) return { saved: false, limited: true };
    const { fetchVerifiedBook } = await import("@/lib/externalCatalog.server");
    const verified = await fetchVerifiedBook(data);
    if (!verified) return { saved: false };
    const row = toRow(verified.book, data.source, verified.sourceUrl);
    const { data: existing } = await db
      .from("book_catalog")
      .select("*")
      .eq("dedupe_key", row.dedupe_key)
      .maybeSingle();
    const merged = mergeRow((existing ?? undefined) as CatalogRow | undefined, row);
    const { error } = await db
      .from("book_catalog")
      .upsert(
        { ...merged, last_validated_at: new Date().toISOString() },
        { onConflict: "dedupe_key" },
      );
    return { saved: !error };
  });
