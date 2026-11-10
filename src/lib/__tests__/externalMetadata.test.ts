import { describe, expect, it, vi } from "vitest";
import {
  mapGoogleVolume,
  mapOpenLibraryDoc,
  parseExternalRef,
  refFromBook,
  safeCover,
  yearFromDate,
} from "../externalMappers";
import { fetchLimitedJson, fetchVerifiedBook, urlForRef } from "../externalCatalog.server";
import { parseBiblionetBooks, parseBiblionetMeta } from "../greekBooks.server";
import { toRow } from "../catalog";

const gb = {
  id: "abcDEF123",
  volumeInfo: {
    title: "Η γλώσσα των δράκων",
    authors: ["S. F. Williamson"],
    publisher: "Ψυχογιός",
    publishedDate: "2023-05-10",
    language: "el",
    industryIdentifiers: [{ type: "ISBN_13", identifier: "9786181001852" }],
    imageLinks: { thumbnail: "http://books.google.com/x.jpg" },
  },
};

describe("Google Books mapping", () => {
  it("carries explicit publisher, year, language and upgrades cover to https", () => {
    const b = mapGoogleVolume(gb);
    expect(b).toMatchObject({ publisher: "Ψυχογιός", publishedYear: 2023, languageCode: "el" });
    expect(b.coverUrl.startsWith("https://")).toBe(true);
    const r = toRow(b, "google");
    expect(r.published_year).toBe(2023);
    expect(r.edition_key).toBe("isbn:9786181001852");
  });
  it("leaves missing or invalid metadata absent", () => {
    const b = mapGoogleVolume({
      id: "x1y2z3",
      volumeInfo: { title: "T", publishedDate: "circa 1990", language: "english!!" },
    });
    expect(b.publisher).toBeUndefined();
    expect(b.publishedYear).toBeUndefined();
    expect(b.languageCode).toBeUndefined();
    expect(yearFromDate("0999")).toBeNull();
    expect(yearFromDate("2023-13")).toBeNull();
    expect(safeCover("javascript:alert(1)")).toBe("");
    expect(safeCover("ftp://x/y.jpg")).toBe("");
  });
});

describe("Open Library mapping", () => {
  it("keeps single publisher/language, never uses first_publish_year as edition year", () => {
    const b = mapOpenLibraryDoc({
      key: "/works/OL1W",
      title: "Dune",
      author_name: ["Frank Herbert"],
      publisher: ["Ace"],
      language: ["eng"],
      first_publish_year: 1965,
    });
    expect(b).toMatchObject({ publisher: "Ace", languageCode: "eng" });
    expect(b.publishedYear).toBeUndefined();
  });
  it("drops ambiguous multi-edition values", () => {
    const b = mapOpenLibraryDoc({
      key: "/works/OL1W",
      title: "Dune",
      publisher: ["Ace", "Chilton"],
      language: ["eng", "spa"],
    });
    expect(b.publisher).toBeUndefined();
    expect(b.languageCode).toBeUndefined();
  });
});

describe("Biblionet metadata", () => {
  it("extracts labelled fields only", () => {
    const m = parseBiblionetMeta(
      "Εκδότης: Ψυχογιός Έτος έκδοσης: 2023 Σειρά: Οι δράκοι, τόμος 2 ISBN 978-618-10-0185-2",
    );
    expect(m).toEqual({
      publisher: "Ψυχογιός",
      publishedYear: 2023,
      series: "Οι δράκοι",
      seriesNumber: "2",
    });
    expect(parseBiblionetMeta("Ένα βιβλίο του 2023 από τον Ψυχογιό")).toEqual({});
    expect(parseBiblionetMeta("Έτος: 0042")).toEqual({});
  });
  it("still parses result blocks without metadata", () => {
    const html = `<img alt="Εξώφυλλο" src="/c.jpg"><a class="book_title" href="/book/1">Τίτλος</a>
      <a class="author" href="/author/2">Συγγραφέας</a>`;
    const [b] = parseBiblionetBooks(html, 5);
    expect(b.title).toBe("Τίτλος");
    expect(b.publisher).toBeUndefined();
  });
});

describe("server validation boundaries", () => {
  it("accepts only well-formed refs", () => {
    expect(parseExternalRef({ source: "google", id: "abcDEF123" })).toBeTruthy();
    expect(parseExternalRef({ source: "openlibrary", id: "/works/OL82563W" })).toBeTruthy();
    for (const bad of [
      { source: "google", id: "../../etc" },
      { source: "google", id: "a" },
      { source: "openlibrary", id: "/books/OL1M" },
      { source: "openlibrary", id: "https://evil.com/works/OL1W" },
      { source: "evil", id: "abcDEF123" },
      { source: "google", id: 5 },
      null,
    ])
      expect(parseExternalRef(bad)).toBeNull();
    expect(refFromBook({ id: "bn:x" })).toBeNull();
    expect(refFromBook({ id: "gb:abcDEF123" })).toEqual({ source: "google", id: "abcDEF123" });
  });
  it("refuses non-allow-listed origins without fetching", async () => {
    const f = vi.fn();
    expect(await fetchLimitedJson("https://evil.com/x", f as unknown as typeof fetch)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("rejects oversized responses", async () => {
    const f = vi.fn(async () => new Response("x".repeat(400_000)));
    expect(
      await fetchLimitedJson(urlForRef({ source: "google", id: "abcDEF123" }), f as never),
    ).toBeNull();
  });
  it("verifies the record matches the requested ID", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify(gb)));
    const r = await fetchVerifiedBook({ source: "google", id: "abcDEF123" }, ok as never);
    expect(r?.book.publisher).toBe("Ψυχογιός");
    expect(r?.sourceUrl).toContain("books.google.com");
    const mismatch = vi.fn(async () => new Response(JSON.stringify({ ...gb, id: "other1" })));
    expect(
      await fetchVerifiedBook({ source: "google", id: "abcDEF123" }, mismatch as never),
    ).toBeNull();
    const fail = vi.fn(async () => new Response("no", { status: 500 }));
    expect(
      await fetchVerifiedBook({ source: "openlibrary", id: "/works/OL1W" }, fail as never),
    ).toBeNull();
  });
});
