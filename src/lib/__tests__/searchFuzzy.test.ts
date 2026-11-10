import { describe, it, expect } from "vitest";
import {
  rankBooks,
  scoreBook,
  editDistance,
  allowsFuzzy,
  fuzzySimilarity,
  EXCLUDED,
} from "../searchRank";
import type { Book } from "../books";

const b = (id: string, title: string, author = "X", popularity?: number): Book =>
  ({ id, title, author, isbn: "", genre: "", coverUrl: "", description: "", popularity }) as Book;

const anti = b("anti", "There Is No Antimemetics Division", "qntm", 1);
const antifa = b("antifa", "Antifa: The Anti-Fascist Handbook", "Mark Bray", 9);
const noise = b("noise", "Cooking for Everyone", "Chef", 10);

describe("editDistance", () => {
  it("counts substitution, insertion, deletion, transposition as 1", () => {
    expect(editDistance("potter", "pottar", 1)).toBe(1);
    expect(editDistance("potter", "pottter", 1)).toBe(1);
    expect(editDistance("potter", "poter", 1)).toBe(1);
    expect(editDistance("potter", "pottre", 1)).toBe(1);
  });
  it("bails out above the budget", () => {
    expect(editDistance("division", "cooking", 2)).toBe(3);
  });
});

describe("typo-tolerant ranking", () => {
  it.each([
    ["harry pottar", "substitution"],
    ["harry pottter", "insertion"],
    ["harry poter", "deletion"],
    ["harry pottre", "transposition"],
  ])("%s (%s) finds Harry Potter", (q) => {
    const out = rankBooks(q, [noise, b("hp", "Harry Potter and the Goblet of Fire")]);
    expect(out.map((x) => x.id)).toEqual(["hp"]);
  });
  it("Antimemetics misspelling surfaces the book above irrelevant ones", () => {
    const out = rankBooks("There is no antimetics division", [antifa, noise, anti]);
    expect(out[0].id).toBe("anti");
    expect(out).not.toContain(noise);
    expect(rankBooks("antimemtics", [antifa, anti])[0].id).toBe("anti");
  });
  it("fuzzy never outranks exact, prefix or strong matches", () => {
    const out = rankBooks("Dune Messiah", [
      b("f", "Dune Mesiah", "F", 99),
      b("e", "Dune Messiah", "F", 0),
    ]);
    expect(out[0].id).toBe("e");
    const p = rankBooks("cosmos", [b("typo", "Kosmos", "K", 99), b("pre", "Cosmos Explained")]);
    expect(p[0].id).toBe("pre");
  });
  it("fuzzy title outranks exact author match", () => {
    const out = rankBooks("dracula", [
      b("a", "Collected Stories", "Dracula Fan"),
      b("t", "Dracla"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["t", "a"]);
  });
  it("rejects false positives", () => {
    expect(scoreBook("There is no anti", noise).tier).toBe(EXCLUDED);
    expect(scoreBook("harry", b("c", "Carry On")).tier).toBe(EXCLUDED);
    expect(scoreBook("dune", b("d", "Dine Out")).tier).toBe(EXCLUDED);
    expect(fuzzySimilarity("antimetics division", "cooking for everyone")).toBe(0);
  });
  it("no fuzzy for short, numeric or ISBN queries", () => {
    expect(allowsFuzzy("It")).toBe(false);
    expect(allowsFuzzy("abc")).toBe(false);
    expect(allowsFuzzy("1984")).toBe(false);
    expect(allowsFuzzy("978-618-10-0185-2")).toBe(false);
    expect(rankBooks("It", [b("t", "Ot"), b("i", "It")]).map((x) => x.id)).toEqual(["i"]);
    const isbn = { ...b("n", "Book"), isbn: "9786181001853" };
    expect(scoreBook("978-618-10-0185-2", isbn).tier).toBe(EXCLUDED);
  });
  it("caps query size", () => {
    expect(fuzzySimilarity("a".repeat(81), "a")).toBe(0);
  });
});
