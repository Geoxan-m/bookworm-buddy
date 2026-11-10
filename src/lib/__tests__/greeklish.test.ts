import { describe, it, expect } from "vitest";
import { greeklishSkeleton, latinToGreekQuery, crossScriptKey } from "../greeklish";
import { rankBooks, scoreBook, EXCLUDED, forms, MAX_FORMS } from "../searchRank";
import { dedupeBooks } from "../searchBooks";
import { expandQueries } from "../greekBooks.server";
import type { Book } from "../books";

const b = (id: string, title: string, author = "A", extra: Partial<Book> = {}): Book =>
  ({ id, title, author, isbn: "", genre: "", coverUrl: "", description: "", ...extra }) as Book;
const GR = "Η γλώσσα των δράκων";

describe("Greeklish skeleton", () => {
  it("native Greek and Greeklish compare equal, accent/case-insensitive", () => {
    const g = greeklishSkeleton(GR);
    expect(greeklishSkeleton("i glossa ton drakon")).toBe(g);
    expect(greeklishSkeleton("I GLOSSA TWN DRAKWN")).toBe(g);
    expect(greeklishSkeleton("η ΓΛΩΣΣΑ των δρακων")).toBe(g);
  });
  it("common alternative spellings fold together", () => {
    const pairs: [string, string][] = [
      ["θάλασσα", "8alassa"],
      ["θάλασσα", "thalassa"],
      ["χαρά", "xara"],
      ["χαρά", "chara"],
      ["ψυχή", "psyxi"],
      ["ξένος", "ksenos"],
      ["ξένος", "xenos"],
      ["μπαμπάς", "babas"],
      ["ντομάτα", "domata"],
      ["αγκάθι", "agathi"],
      ["ουρανός", "uranos"],
      ["ουρανός", "ouranos"],
    ];
    for (const [a, c] of pairs) expect(greeklishSkeleton(c)).toBe(greeklishSkeleton(a));
  });
  it("leaves digits alone and builds bounded Greek query", () => {
    expect(greeklishSkeleton("1984")).toBe("1984");
    expect(latinToGreekQuery("i glossa ton drakon")).toBe("ι γλοσσα τον δρακον");
    expect(latinToGreekQuery("978-618-10-0185-2")).toBeNull();
    expect(latinToGreekQuery("It")).toBeNull();
    expect(latinToGreekQuery(GR)).toBeNull();
    expect(forms(GR).length).toBeLessThanOrEqual(MAX_FORMS);
    expect(expandQueries("i glossa ton drakon").length).toBeLessThanOrEqual(4);
    expect(expandQueries("i glossa ton drakon")).toContain("ι γλοσσα τον δρακον");
    expect(expandQueries("978-618-10-0185-2")).toEqual(["9786181001852"]);
  });
});

describe("cross-script ranking", () => {
  const books = [b("x", "Glass Dragons"), b("g", GR, "S. F. Williamson")];
  it("Greeklish and native queries both find the Greek title first", () => {
    expect(rankBooks("i glossa ton drakon", books)[0].id).toBe("g");
    expect(rankBooks("glossa ton drak", books)[0].id).toBe("g");
    expect(rankBooks("Η ΓΛΩΣΣΑ ΤΩΝ ΔΡΑΚΩΝ", books)[0].id).toBe("g");
    expect(scoreBook("i glossa ton drakon", books[1]).tier).toBe(0);
  });
  it("short queries and ISBNs stay strict", () => {
    expect(scoreBook("ou", b("1", "Ουρανός")).tier).toBe(EXCLUDED);
    expect(scoreBook("9786181001852", b("1", "9786181001852 notes")).tier).toBe(EXCLUDED);
  });
  it("rejects unrelated look-alikes", () => {
    expect(scoreBook("i glossa ton drakon", b("1", "Η γλώσσα των πουλιών")).tier).toBeGreaterThan(
      1,
    );
    expect(scoreBook("thalassa", b("1", "Παλάτι")).tier).toBe(EXCLUDED);
  });
});

describe("cross-source dedupe", () => {
  it("merges same book across scripts and keeps richest metadata", () => {
    const out = dedupeBooks([
      b("gr", GR, "Σ. Φ. Γουίλιαμσον"),
      b("lat", "I glossa ton drakon", "S. F. Gouiliamson", {
        coverUrl: "https://c/x.jpg",
        description: "Long description",
        publishedYear: 2023,
        isbn: "978-618-10-0185-2",
        popularity: 2,
      }),
      b("bad", GR, "Σ. Φ. Γουίλιαμσον", { coverUrl: "http://insecure" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "gr",
      title: GR,
      coverUrl: "https://c/x.jpg",
      isbn: "978-618-10-0185-2",
      publishedYear: 2023,
      popularity: 2,
    });
  });
  it("never overwrites good data with blanks", () => {
    const [m] = dedupeBooks([
      b("1", "Dune", "Frank Herbert", { genre: "Sci-fi" }),
      b("2", "Dune", "Frank Herbert"),
    ]);
    expect(m.genre).toBe("Sci-fi");
  });
  it("keeps distinct editions, different authors and missing-author look-alikes", () => {
    expect(
      dedupeBooks([
        b("1", "Dune", "Frank Herbert", { isbn: "9780441013593" }),
        b("2", "Dune", "Frank Herbert", { isbn: "9780340960196" }),
      ]),
    ).toHaveLength(2);
    expect(
      dedupeBooks([b("1", GR, "S. F. Williamson"), b("2", "i glossa ton drakon", "Other Person")]),
    ).toHaveLength(2);
    expect(crossScriptKey(GR, "")).toBeNull();
    expect(dedupeBooks([b("1", GR, ""), b("2", "i glossa ton drakon", "")])).toHaveLength(2);
  });
});
