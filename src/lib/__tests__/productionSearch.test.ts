import { describe, it, expect, vi } from "vitest";
import { cachedSearch, toRow, catalogCandidateFilter, type CatalogRow } from "../catalog";
import { searchInternational, providerUrls, ProviderSearchError } from "../intlBooks.server";
import { fetchJsonResult, MAX_BYTES } from "../externalCatalog.server";
import { rankBooks, scoreBook } from "../searchRank";
import type { Book } from "../books";

const book = (title: string, extra: Partial<Book> = {}): Book => ({
  id: title,
  title,
  author: "Author",
  isbn: "",
  genre: "",
  description: "",
  coverUrl: "",
  ...extra,
});
const json = (data: unknown) => new Response(JSON.stringify(data));
const deps = () => ({
  readCache: vi.fn(async () => null as { fetched_at: string; result_keys?: string[] } | null),
  readCatalog: vi.fn(async () => [] as CatalogRow[]),
  readByKeys: vi.fn(async () => [] as CatalogRow[]),
  fetchExternal: vi.fn(async () => [] as Book[]),
  write: vi.fn(async (_key: string, _rows: CatalogRow[]) => {}),
});

describe("production provider/cache correction", () => {
  it("requests projected small payloads and maps their source metadata", async () => {
    for (const url of providerUrls("harry potter", 20)) {
      const u = new URL(url);
      expect(u.searchParams.get("fields")).toContain(
        u.hostname.includes("google") ? "volumeInfo" : "author_name",
      );
      expect(
        Number(u.searchParams.get(u.hostname.includes("google") ? "maxResults" : "limit")),
      ).toBe(10);
    }
    const fetcher = vi.fn(async (url: string) =>
      url.includes("googleapis")
        ? json({
            totalItems: 1,
            items: [
              {
                id: "abc123",
                volumeInfo: {
                  title: "Harry Potter",
                  authors: ["J K Rowling"],
                  publisher: "Bloomsbury",
                },
              },
            ],
          })
        : json({
            docs: [{ key: "/works/OL1W", title: "Harry Potter", author_name: ["J K Rowling"] }],
          }),
    );
    const books = await searchInternational("harry potter", 20, fetcher as never);
    expect(books).toHaveLength(1);
    expect(books[0].publisher).toBe("Bloomsbury");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("all failures do not write a cache and the next request retries", async () => {
    const d = deps();
    d.readCatalog.mockResolvedValue([toRow(book("Harry Potter"), "google")]);
    const f = vi.fn(async () => new Response("unavailable", { status: 503 }));
    d.fetchExternal.mockImplementation(() => searchInternational("harry", 10, f as never));
    for (let i = 0; i < 2; i++)
      expect((await cachedSearch("harry", d, { namespace: "intl" })).cache).toBe("error");
    expect(d.write).not.toHaveBeenCalled();
    expect(d.fetchExternal).toHaveBeenCalledTimes(2);
    expect(f).toHaveBeenCalledTimes(8);
  });
  it("keeps real popularity transient on uncached responses", async () => {
    const d = deps();
    d.fetchExternal.mockResolvedValue([
      book("Harry One", { popularity: 1 }),
      book("Harry Two", { popularity: 2 }),
    ]);
    const r = await cachedSearch("harry", d);
    expect(r.books[0].title).toBe("Harry Two");
    expect(d.write.mock.calls[0]?.[1]?.[0]).not.toHaveProperty("popularity");
  });
  it("fresh empty and unresolved keys retry even with local results", async () => {
    for (const keys of [[], ["missing"]]) {
      const d = deps();
      d.readCache.mockResolvedValue({ fetched_at: new Date().toISOString(), result_keys: keys });
      d.readCatalog.mockResolvedValue([toRow(book("Harry Potter"), "google")]);
      await cachedSearch("harry", d);
      expect(d.fetchExternal).toHaveBeenCalledTimes(1);
    }
  });
  it("fresh nonempty keys reconstruct actual books without whole-query local hits", async () => {
    const d = deps();
    const row = toRow(book("Fifty Shades of Grey"), "google");
    d.readCache.mockResolvedValue({
      fetched_at: new Date().toISOString(),
      result_keys: [row.dedupe_key],
    });
    d.readByKeys.mockResolvedValue([row]);
    const r = await cachedSearch("50 shades of gray", d);
    expect(r.books.map((b) => b.title)).toEqual(["Fifty Shades of Grey"]);
    expect(d.readByKeys).toHaveBeenCalledWith([row.dedupe_key]);
    expect(d.fetchExternal).not.toHaveBeenCalled();
  });
  it("valid zero is distinct from schema failure", async () => {
    expect(
      await searchInternational(
        "none",
        10,
        vi.fn(async (url: string) =>
          json(url.includes("googleapis") ? { totalItems: 0 } : { docs: [] }),
        ) as never,
      ),
    ).toEqual([]);
    await expect(
      searchInternational("none", 10, vi.fn(async () => json({ error: "bad" })) as never),
    ).rejects.toBeInstanceOf(ProviderSearchError);
  });
  it.each(["http", "transport", "json", "oversized", "timeout"])(
    "classifies %s failures",
    async (reason) => {
      const f = vi.fn(async (_url: string, init?: RequestInit) => {
        if (reason === "transport") throw new Error("offline");
        if (reason === "timeout")
          return new Promise<Response>((_resolve, reject) =>
            init?.signal?.addEventListener("abort", () => reject(new Error("abort"))),
          );
        if (reason === "http") return new Response("", { status: 429 });
        return new Response(reason === "oversized" ? "é".repeat(MAX_BYTES / 2 + 1) : "not json");
      });
      if (reason === "timeout") vi.useFakeTimers();
      try {
        const result = fetchJsonResult("https://openlibrary.org/search.json", f as never);
        if (reason === "timeout") await vi.advanceTimersByTimeAsync(4001);
        expect(await result).toEqual({ ok: false, reason });
      } finally {
        vi.useRealTimers();
      }
    },
  );
  it("catalogue retrieval uses bounded normalized tokens, not raw filter syntax", () => {
    const filter = catalogCandidateFilter("50 shades of gray,(author.eq.evil)%_");
    expect(filter).toContain("title_norm.ilike.%fifty%");
    expect(filter).toContain("title_norm.ilike.%grey%");
    expect(filter).not.toContain("author.eq.evil");
    expect(filter.split(",").length).toBeLessThanOrEqual(16);
  });
});

describe("production ranking", () => {
  it.each(["harry", "harry p", "harry pot", "harry potter"])("Harry Potter ranks for %s", (q) => {
    expect(
      rankBooks(q, [
        book("Other", { author: "Harry Potter", popularity: 100 }),
        book("Harry Potter and the Philosopher's Stone"),
      ])[0].title,
    ).toContain("Harry Potter");
  });
  it.each(["50", "50 shades", "50 shades of gray", "50 shades of grey"])(
    "Fifty Shades ranks for %s",
    (q) => {
      expect(
        rankBooks(q, [
          book("Other", { author: "Fifty Shades", popularity: 100 }),
          book("Fifty Shades of Grey"),
        ])[0].title,
      ).toBe("Fifty Shades of Grey");
    },
  );
  it("exact, prefix/phrase, ordered, fuzzy, author stay in order despite popularity", () => {
    const titles = [
      book("Other", { author: "harry potter", popularity: 100 }),
      book("Potter and Harry"),
      book("Harry very Potter"),
      book("The Harry Potter Collection"),
      book("Harry Potter"),
    ];
    expect(rankBooks("harry potter", titles).map((b) => b.title)).toEqual([
      "Harry Potter",
      "The Harry Potter Collection",
      "Harry very Potter",
      "Potter and Harry",
      "Other",
    ]);
    expect(scoreBook("harry potter", book("The Harry Potter Collection")).tier).toBe(1);
  });
});
