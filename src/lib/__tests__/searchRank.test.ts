import { describe, it, expect, vi } from "vitest";
import {
  rankBooks,
  scoreBook,
  numberAlias,
  allowsExternal,
  isShortAlpha,
  EXCLUDED,
} from "../searchRank";
import { progressiveSearch } from "../searchMerge";
import type { Book } from "../books";

const b = (id: string, title: string, author = "X", popularity?: number): Book =>
  ({ id, title, author, isbn: "", genre: "", coverUrl: "", description: "", popularity }) as Book;

const antifa = b("antifa", "Antifa: The Anti-Fascist Handbook", "Mark Bray", 9);
const anti = b("anti", "There Is No Antimemetics Division", "qntm", 1);
const noise = b("noise", "Cooking for Everyone", "Chef", 10);

describe("rankBooks", () => {
  it.each(["There is no", "There is no anti", "there is no antimemetics"])(
    "ranks Antimemetics above Antifa for %s",
    (q) => {
      const out = rankBooks(q, [antifa, noise, anti]).map((x) => x.id);
      expect(out[0]).toBe("anti");
      expect(out).not.toContain("noise");
    },
  );
  it("exact title beats prefix and popularity", () => {
    const out = rankBooks("Dune", [b("p", "Dune Messiah", "F", 9), b("e", "Dune", "F", 0)]);
    expect(out.map((x) => x.id)).toEqual(["e", "p"]);
  });
  it("authors rank after titles", () => {
    const out = rankBooks("king", [b("a", "Carrie", "Stephen King", 9), b("t", "King Rat", "J")]);
    expect(out.map((x) => x.id)).toEqual(["t", "a"]);
  });
  it("filters irrelevant results", () => {
    expect(scoreBook("There is no anti", noise).tier).toBe(EXCLUDED);
  });
  it("popularity only breaks ties", () => {
    const out = rankBooks("harry", [
      b("l", "Harry Potter 1", "R", 1),
      b("h", "Harry Potter 2", "R", 8),
    ]);
    expect(out[0].id).toBe("h");
    const out2 = rankBooks("harry potter 1", [
      b("h", "Harry Potter 2", "R", 99),
      b("l", "Harry Potter 1", "R"),
    ]);
    expect(out2[0].id).toBe("l");
  });
  it("short queries keep exact titles, no fuzzy noise", () => {
    const out = rankBooks("It", [
      b("w", "Twilight"),
      b("i", "It", "Stephen King"),
      b("p", "Italian Food"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["i", "p"]);
    expect(isShortAlpha("It")).toBe(true);
    expect(allowsExternal("It")).toBe(false);
    expect(allowsExternal("50")).toBe(true);
    expect(allowsExternal("dun")).toBe(true);
  });
  it.each(["50", "fift"])("%s prioritizes Fifty Shades of Grey", (q) => {
    const out = rankBooks(q, [b("x", "Half Moon"), b("f", "Fifty Shades of Grey", "E L James")]);
    expect(out[0].id).toBe("f");
  });
  it("number aliases cover 0–100 only", () => {
    expect(numberAlias("0")).toBe("zero");
    expect(numberAlias("21")).toBe("twenty one");
    expect(numberAlias("100")).toBe("one hundred");
    expect(numberAlias("101")).toBeNull();
  });
});

describe("stale searches", () => {
  it("aborted search never updates suggestions", async () => {
    const ctrl = new AbortController();
    const onUpdate = vi.fn();
    const p = progressiveSearch(
      [{ run: () => new Promise<Book[]>((r) => setTimeout(() => r([anti]), 10)) }],
      ctrl.signal,
      onUpdate,
    );
    ctrl.abort();
    await p;
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
