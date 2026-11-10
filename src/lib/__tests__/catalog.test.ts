import { describe, it, expect, vi } from "vitest";
import { cachedSearch, mergeRow, toRow, dedupeRows, isFresh, type CatalogRow } from "../catalog";
import type { Book } from "../books";

const book = (p: Partial<Book>): Book => ({
  id: "x",
  isbn: "",
  title: "Η γλώσσα των δράκων",
  author: "S. F. Williamson",
  genre: "",
  coverUrl: "",
  description: "",
  ...p,
});

function deps(o: Partial<Parameters<typeof cachedSearch>[1]> = {}) {
  return {
    readCache: vi.fn(async () => null),
    readCatalog: vi.fn(async () => [] as CatalogRow[]),
    fetchExternal: vi.fn(async () => [] as Book[]),
    write: vi.fn(async () => {}),
    now: () => Date.parse("2026-09-27T00:00:00Z"),
    ...o,
  };
}

describe("catalog", () => {
  it("cache hit returns local results without external call", async () => {
    const d = deps({
      readCache: async () => ({
        fetched_at: "2026-09-26T00:00:00Z",
        result_keys: [toRow(book({}), "biblionet").dedupe_key],
      }),
      readByKeys: async () => [toRow(book({}), "biblionet")],
      readCatalog: async () => [toRow(book({}), "biblionet")],
    });
    const r = await cachedSearch("γλωσσα δρακων", d);
    expect(r.cache).toBe("hit");
    expect(r.books).toHaveLength(1);
    expect(d.fetchExternal).not.toHaveBeenCalled();
  });
  it("miss fetches, upserts valid rows only", async () => {
    const d = deps({
      fetchExternal: async () => [book({ isbn: "978-618-10-0185-2" }), book({ title: "" })],
    });
    const r = await cachedSearch("δρακων", d);
    expect(r.cache).toBe("miss");
    expect(d.write).toHaveBeenCalledWith("δρακων", [
      expect.objectContaining({ isbn_norm: "9786181001852" }),
    ]);
  });
  it("stale cache refetches", async () => {
    const d = deps({ readCache: async () => ({ fetched_at: "2026-01-01T00:00:00Z" }) });
    expect((await cachedSearch("abcd", d)).cache).toBe("stale");
    expect(d.fetchExternal).toHaveBeenCalled();
    expect(isFresh(null)).toBe(false);
  });
  it("external failure falls back to local", async () => {
    const d = deps({
      readCatalog: async () => [toRow(book({}), "biblionet")],
      fetchExternal: async () => {
        throw new Error("down");
      },
    });
    const r = await cachedSearch("δρακων", d);
    expect(r.cache).toBe("error");
    expect(r.books).toHaveLength(1);
    expect(d.write).not.toHaveBeenCalled();
  });
  it("merge never overwrites with empty fields", () => {
    const a = toRow(book({ coverUrl: "https://c/1.jpg", description: "long text" }), "biblionet");
    const b = toRow(book({}), "biblionet");
    const m = mergeRow(a, b);
    expect(m.cover_url).toBe("https://c/1.jpg");
    expect(m.description).toBe("long text");
  });
  it("dedupes by ISBN then title+author", () => {
    const rows = dedupeRows([
      toRow(book({ isbn: "9786181001852" }), "a"),
      toRow(book({ isbn: "978-618-10-0185-2", title: "Other" }), "b"),
      toRow(book({ title: "η ΓΛΩΣΣΑ των Δρακων" }), "c"),
      toRow(book({ title: "Γλώσσα των δράκων" }), "d"),
    ]);
    expect(rows).toHaveLength(2);
  });
});
