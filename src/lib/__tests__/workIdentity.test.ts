import { describe, expect, it } from "vitest";
import { editionKey, normalizeSeriesTitle, parseSeriesNumber, workKey } from "../workIdentity";
import { fromRow, mergeRow, toRow, type CatalogRow } from "../catalog";

const base = { title: "Η γλώσσα των δράκων", author: "S. F. Williamson" };

describe("work / edition identity", () => {
  it("same work, different editions => same work_key, different edition_key", () => {
    const a = { ...base, isbn: "978-618-10-0185-2" };
    const b = { ...base, title: "Γλώσσα των Δράκων", isbn: "9780008560799" };
    expect(workKey(a)).toBe(workKey(b));
    expect(editionKey(a)).not.toBe(editionKey(b));
    const c = { ...base, publisher: "Ψυχογιός", publishedYear: 2023 };
    const d = { ...base, publisher: "Ψυχογιός", publishedYear: 2024 };
    expect(workKey(c)).toBe(workKey(d));
    expect(editionKey(c)).not.toBe(editionKey(d));
  });
  it("is deterministic and null for empty titles", () => {
    expect(editionKey(base)).toBe(editionKey({ ...base }));
    expect(workKey({ title: "  " })).toBeNull();
  });
});

describe("series", () => {
  it("normalizes Greek accents, case and final sigma", () => {
    expect(normalizeSeriesTitle("Ο ΆΡΧΟΝΤΑΣ των Δαχτυλιδιών")).toBe(
      normalizeSeriesTitle("ο αρχοντας των δαχτυλιδιων"),
    );
    expect(normalizeSeriesTitle("Τόμος")).toBe(normalizeSeriesTitle("ΤΟΜΟΣ"));
    expect(normalizeSeriesTitle("")).toBeNull();
  });
  it("parses integer and decimal volumes", () => {
    expect(parseSeriesNumber("3")).toBe(3);
    expect(parseSeriesNumber("2.5")).toBe(2.5);
    expect(parseSeriesNumber("2,5")).toBe(2.5);
    expect(parseSeriesNumber("#4")).toBe(4);
    expect(parseSeriesNumber("Vol. 7")).toBe(7);
    expect(parseSeriesNumber("Τόμος 2")).toBe(2);
    expect(parseSeriesNumber(5)).toBe(5);
  });
  it("rejects ambiguous text", () => {
    for (const v of ["", "1-3", "II", "first", "1 και 2", "2 of 5", "0", "-1", "12345", null])
      expect(parseSeriesNumber(v)).toBeNull();
  });
});

describe("catalog mapping", () => {
  it("never invents metadata", () => {
    const r = toRow({ id: "x", isbn: "", ...base, genre: "", coverUrl: "", description: "" }, "t");
    expect(r.series_title).toBeNull();
    expect(r.series_number).toBeNull();
    expect(r.publisher).toBeNull();
    expect(r.published_year).toBeNull();
    expect(r.language_code).toBeNull();
    expect(r.work_key).toBeTruthy();
  });
  it("carries provided metadata and rejects invalid year/language", () => {
    const r = toRow(
      {
        id: "x",
        isbn: "",
        ...base,
        genre: "",
        coverUrl: "",
        description: "",
        series: "Τα Χρονικά",
        seriesNumber: "Τόμος 1",
        publisher: "Ψυχογιός",
        publishedYear: 99,
        languageCode: "el-GR",
      },
      "t",
    );
    expect(r.series_title_norm).toBe("τα χρονικα");
    expect(r.series_number).toBe(1);
    expect(r.published_year).toBeNull();
    expect(r.language_code).toBe("el");
  });
  it("handles legacy rows without new fields", () => {
    const legacy: CatalogRow = {
      dedupe_key: "ta:x|y",
      isbn_norm: null,
      title: "X",
      title_norm: "x",
      author: "Y",
      author_norm: "y",
      genre: "",
      cover_url: "",
      description: "",
      source: "b",
      source_id: null,
      source_url: null,
    };
    const b = fromRow(legacy);
    expect(b.series).toBeUndefined();
    expect(b.publisher).toBeUndefined();
    const incoming = { ...legacy, publisher: "P" };
    expect(mergeRow(legacy, incoming).publisher).toBe("P");
    expect(mergeRow({ ...legacy, publisher: "P" }, legacy).publisher).toBe("P");
  });
});
