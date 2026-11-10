import { describe, expect, it, vi } from "vitest";
import { allowed, clientTag, rulesFor, type LimitRule } from "../rateLimit";
import {
  cleanAuthor,
  isPlaceholderAuthor,
  mapGoogleVolume,
  mapOpenLibraryDoc,
  plausibleYear,
  yearFromDate,
} from "../externalMappers";
import { cachedSearch, fromRow, mergeRow, toRow, type CatalogRow } from "../catalog";
import { parseBiblionetMeta } from "../greekBooks.server";
import type { Book } from "../books";

const NOW = new Date("2026-10-04T00:00:00Z");
const book = (p: Partial<Book> = {}): Book => ({
  id: "x",
  isbn: "",
  title: "Dune",
  author: "Frank Herbert",
  genre: "",
  coverUrl: "",
  description: "",
  ...p,
});

describe("rate limit guard", () => {
  it("allows when all buckets allow, denies when any denies", async () => {
    const rules = rulesFor("external", "abc");
    expect(rules.map((r) => r.bucket)).toEqual(["external:global", "external:c:abc"]);
    expect(await allowed(rules, async () => true)).toBe(true);
    expect(await allowed(rules, async (r: LimitRule) => !r.bucket.includes(":c:"))).toBe(false);
  });
  it("fails closed when the counter store errors", async () => {
    expect(
      await allowed(rulesFor("write", "t"), async () => {
        throw new Error("db");
      }),
    ).toBe(false);
  });
  it("hashes client addresses deterministically without exposing them", async () => {
    const a = await clientTag("203.0.113.5");
    expect(a).toBe(await clientTag("203.0.113.5"));
    expect(a).not.toContain("203");
    expect(a).not.toBe(await clientTag("203.0.113.6"));
    expect(await clientTag(null)).toBe(await clientTag(""));
  });
  it("a limited external fetch falls back to local catalogue results", async () => {
    const local = [toRow(book(), "biblionet")];
    const write = vi.fn(async () => {});
    const r = await cachedSearch("dune", {
      readCache: async () => null,
      readCatalog: async () => local,
      fetchExternal: async () => {
        throw new Error("rate_limited");
      },
      write,
    });
    expect(r.cache).toBe("error");
    expect(r.books).toHaveLength(1);
    expect(write).not.toHaveBeenCalled();
  });
});

describe("strict dates", () => {
  it("accepts structurally valid dates only", () => {
    expect(yearFromDate("2023", NOW)).toBe(2023);
    expect(yearFromDate("2024-02-29", NOW)).toBe(2024);
    for (const bad of [
      "2023-02-29",
      "2023-00",
      "2023-04-31",
      "2023-1-1",
      "23",
      "1999?",
      "c. 1990",
      "2023-05-10T00:00",
      "0999",
      "2028",
      "",
    ])
      expect(yearFromDate(bad, NOW)).toBeNull();
    expect(yearFromDate("2027", NOW)).toBe(2027);
    expect(plausibleYear(2.5, NOW)).toBeNull();
  });
  it("keeps work first-publication year out of the edition year", () => {
    const b = mapOpenLibraryDoc({ key: "/works/OL1W", title: "Dune", first_publish_year: 1965 });
    expect(b.publishedYear).toBeUndefined();
    expect(toRow(b, "openlibrary").published_year).toBeNull();
  });
  it("rejects future Biblionet years", () => {
    expect(parseBiblionetMeta("Έτος: 2999")).toEqual({});
  });
});

describe("placeholder authors", () => {
  it("detects placeholders in English and Greek", () => {
    for (const p of [
      "Unknown",
      " unknown author ",
      "-",
      "N/A",
      "Άγνωστος",
      "ανώνυμος",
      "   ",
      "???",
    ])
      expect(isPlaceholderAuthor(p)).toBe(true);
    expect(cleanAuthor("Ursula K. Le Guin")).toBe("Ursula K. Le Guin");
  });
  it("mappers leave missing authors empty", () => {
    expect(mapGoogleVolume({ id: "abcdef", volumeInfo: { title: "T" } }).author).toBe("");
    expect(
      mapOpenLibraryDoc({ key: "/works/OL1W", title: "T", author_name: ["Unknown"] }).author,
    ).toBe("");
  });
  it("toRow never stores a placeholder; fromRow cleans legacy rows", () => {
    const r = toRow(book({ author: "Unknown" }), "google");
    expect(r.author).toBe("");
    expect(r.author_norm).toBe("");
    expect(fromRow({ ...r, author: "Unknown" }).author).toBe("");
  });
  it("missing author never overwrites a known author or better metadata", () => {
    const known: CatalogRow = toRow(
      book({
        isbn: "9786181001852",
        publisher: "Ace",
        publishedYear: 1990,
        coverUrl: "https://c/1.jpg",
      }),
      "google",
    );
    const worse = toRow(book({ isbn: "9786181001852", author: "Unknown" }), "openlibrary");
    const m = mergeRow(known, worse);
    expect(m.author).toBe("Frank Herbert");
    expect(m.author_norm).toBe(known.author_norm);
    expect(m.publisher).toBe("Ace");
    expect(m.published_year).toBe(1990);
    expect(m.cover_url).toBe("https://c/1.jpg");
  });
});
