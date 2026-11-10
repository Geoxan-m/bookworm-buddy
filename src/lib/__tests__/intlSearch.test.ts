import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { cachedSearch, cacheKeyFor, toRow, type CatalogRow } from "../catalog";
import { providerUrls, searchInternational, MAX_POOL } from "../intlBooks.server";
import { fetchLimitedJson, MAX_BYTES } from "../externalCatalog.server";
import { rulesFor } from "../rateLimit";
import { progressiveSearch } from "../searchMerge";
import type { Book } from "../books";

const NOW = Date.parse("2026-10-16T00:00:00Z");
const book = (p: Partial<Book> = {}): Book => ({
  id: "gb:abc",
  isbn: "",
  title: "Dune",
  author: "Frank Herbert",
  genre: "",
  coverUrl: "",
  description: "",
  ...p,
});
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

function deps(o = {}) {
  return {
    readCache: vi.fn(async (_k: string) => null as { fetched_at: string } | null),
    readCatalog: vi.fn(async () => [] as CatalogRow[]),
    fetchExternal: vi.fn(async () => [] as Book[]),
    write: vi.fn(async (_k: string, _r: CatalogRow[]) => {}),
    now: () => NOW,
    ...o,
  };
}
const intl = {
  source: (b: Book) => (b.id.startsWith("gb:") ? "google" : "openlibrary"),
  namespace: "intl",
};

describe("international cache", () => {
  it("fresh intl entry returns catalogue rows with zero provider calls", async () => {
    const d = deps({
      readCache: vi.fn(async () => ({
        fetched_at: "2026-10-15T00:00:00Z",
        result_keys: [toRow(book(), "google").dedupe_key],
      })),
      readByKeys: vi.fn(async () => [toRow(book(), "google")]),
      readCatalog: vi.fn(async () => [toRow(book(), "google")]),
    });
    const r = await cachedSearch("Dune", d, intl);
    expect(r.cache).toBe("hit");
    expect(d.fetchExternal).not.toHaveBeenCalled();
    expect(d.readCache).toHaveBeenCalledWith("intl:dune");
  });
  it("stale entry refreshes, writes namespaced key and per-book source", async () => {
    const d = deps({
      readCache: vi.fn(async () => ({ fetched_at: "2026-10-01T00:00:00Z" })),
      fetchExternal: vi.fn(async () => [
        book(),
        book({ id: "/works/OL1W", title: "Emma", author: "Austen" }),
      ]),
    });
    const r = await cachedSearch("Dune", d, intl);
    expect(r.cache).toBe("stale");
    const [key, rows] = d.write.mock.calls[0];
    expect(key).toBe("intl:dune");
    expect(rows.map((x) => x.source).sort()).toEqual(["google", "openlibrary"]);
  });
  it("miss caps upserts at 30", async () => {
    const many = Array.from({ length: 50 }, (_, i) => book({ id: `gb:${i}`, title: `Book ${i}` }));
    const d = deps({ fetchExternal: vi.fn(async () => many) });
    await cachedSearch("book", d, intl);
    expect(d.write.mock.calls[0][1].length).toBe(30);
  });
  it("namespace never collides with Biblionet keys", () => {
    expect(cacheKeyFor("Dune", "intl")).toBe("intl:dune");
    expect(cacheKeyFor("Dune")).toBe("dune");
  });
  it("provider failure and rate-limit denial fall back to local matches", async () => {
    for (const err of ["provider_down", "rate_limited"]) {
      const d = deps({
        readCatalog: vi.fn(async () => [toRow(book(), "google")]),
        fetchExternal: vi.fn(async () => {
          throw new Error(err);
        }),
      });
      const r = await cachedSearch("Dune", d, intl);
      expect(r.cache).toBe("error");
      expect(r.books.map((b) => b.title)).toEqual(["Dune"]);
      expect(d.write).not.toHaveBeenCalled();
    }
  });
  it("intl rate-limit buckets are separate from Biblionet ones", () => {
    expect(rulesFor("intl", "t").map((r) => r.bucket)).toEqual(["intl:global", "intl:c:t"]);
  });
});

describe("provider fan-out bounds", () => {
  it("max 6 allow-listed URLs; Greek adds transliteration", () => {
    const urls = providerUrls("Η γλώσσα των δράκων");
    expect(urls.length).toBeLessThanOrEqual(6);
    expect(urls.some((u) => u.includes(encodeURIComponent("i glossa")))).toBe(true);
    for (const u of urls)
      expect(["https://www.googleapis.com", "https://openlibrary.org"]).toContain(
        new URL(u).origin,
      );
  });
  it("numeric/ISBN queries are not transliterated", () => {
    const urls = providerUrls("978-618-10-0185-2");
    expect(urls.length).toBeLessThanOrEqual(4);
    expect(providerUrls("50").some((u) => u.includes("fifty"))).toBe(true);
  });
  it("pool ≤30, one fetch per URL, invalid records dropped", async () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      id: `id${i}`,
      volumeInfo: { title: `T${i}`, authors: ["A"] },
    }));
    const f = vi.fn(async (u: string) =>
      u.includes("googleapis") ? json({ items }) : json({ docs: [{ key: "/works/OL1W" }] }),
    );
    const out = await searchInternational("dune", 10, f as never);
    expect(f.mock.calls.length).toBeLessThanOrEqual(6);
    expect(out.length).toBeLessThanOrEqual(MAX_POOL);
    expect(out.some((b) => b.title === "Untitled")).toBe(false);
  });
  it("rejects foreign origins and oversize bodies", async () => {
    const f = vi.fn(async () => json({}));
    expect(await fetchLimitedJson("https://evil.example/x", f as never)).toBeNull();
    expect(f).not.toHaveBeenCalled();
    const big = vi.fn(async () => new Response("x".repeat(MAX_BYTES + 1)));
    expect(await fetchLimitedJson("https://openlibrary.org/a", big as never)).toBeNull();
  });
});

describe("browser code", () => {
  it("never fetches providers directly", () => {
    for (const f of [
      "src/lib/searchBooks.ts",
      "src/components/SearchBar.tsx",
      "src/components/AiSuggestions.tsx",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/googleapis\.com|openlibrary\.org|\bfetch\(/);
    }
  });
  it("stale (aborted) searches never update results", async () => {
    const ctl = new AbortController();
    const onUpdate = vi.fn();
    const p = progressiveSearch(
      [{ run: () => new Promise<Book[]>((r) => setTimeout(() => r([book()]), 10)) }],
      ctl.signal,
      onUpdate,
    );
    ctl.abort();
    await p.catch(() => undefined);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
