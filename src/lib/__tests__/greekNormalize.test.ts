import { describe, it, expect } from "vitest";
import {
  normalizeGreek,
  normalizeIsbn,
  looksLikeIsbn,
  stripLeadingArticle,
  queryVariants,
} from "../greekNormalize";
import { dedupeBooks } from "../searchBooks";
import { parseBiblionetBooks, expandQueries } from "../greekBooks.server";
import type { Book } from "../books";

const TITLE = "Η γλώσσα των δράκων";
const book = (id: string, title: string, author: string, isbn = ""): Book =>
  ({ id, title, author, isbn, genre: "", coverUrl: "", description: "" }) as Book;

describe("normalizeGreek", () => {
  it("folds case, accents, final sigma, punctuation and whitespace", () => {
    expect(normalizeGreek("  Η ΓΛΏΣΣΑ   των Δράκων!! ")).toBe("η γλωσσα των δρακων");
    expect(normalizeGreek("Κρομμύδας")).toBe(normalizeGreek("ΚΡΟΜΜΥΔΑΣ"));
    expect(normalizeGreek("δράκος")).toBe("δρακοσ");
    expect(normalizeGreek("Ϊ ΐ ΰ")).toBe("ι ι υ");
  });
  it("strips a leading Greek article", () => {
    expect(stripLeadingArticle(TITLE)).toBe("γλωσσα των δρακων");
    expect(stripLeadingArticle("Ένας δράκος")).toBe("δρακοσ");
    expect(stripLeadingArticle("Μία ιστορία")).toBe("ιστορια");
    expect(stripLeadingArticle("Το")).toBe("το");
  });
  it("partial 'γλωσσα δρακων' tokens match the normalized title", () => {
    const t = normalizeGreek(TITLE);
    for (const w of normalizeGreek("γλωσσα δρακων").split(" ")) expect(t).toContain(w);
  });
});

describe("ISBN", () => {
  it("normalizes with/without hyphens and ISBN-10 to 13", () => {
    expect(normalizeIsbn("978-618-10-0185-2")).toBe("9786181001852");
    expect(normalizeIsbn("9786181001852")).toBe("9786181001852");
    expect(normalizeIsbn("0-306-40615-2")).toBe("9780306406157");
    expect(normalizeIsbn("abc")).toBe("");
    expect(looksLikeIsbn("978-618-10-0185-2")).toBe(true);
    expect(looksLikeIsbn(TITLE)).toBe(false);
  });
});

describe("query variants", () => {
  it("is small and bounded", () => {
    expect(queryVariants(TITLE)).toEqual([TITLE, "η γλωσσα των δρακων", "γλωσσα των δρακων"]);
    expect(queryVariants("978-618-10-0185-2")).toEqual(["9786181001852"]);
    expect(expandQueries("Κρομμύδας").length).toBeLessThanOrEqual(4);
  });
});

describe("dedupeBooks", () => {
  it("dedupes by ISBN first, else title+author across case/accents/articles", () => {
    const out = dedupeBooks([
      book("1", TITLE, "S. F. Williamson", "978-618-10-0185-2"),
      book("2", "Different edition title", "Other", "9786181001852"),
      book("3", "ΓΛΩΣΣΑ ΤΩΝ ΔΡΑΚΩΝ", "s f williamson"),
      book("4", "Η γλώσσα των δράκων", "Άλλος Συγγραφέας"),
    ]);
    expect(out.map((b) => b.id)).toEqual(["1", "4"]);
  });
});

describe("parseBiblionetBooks", () => {
  const classic = `<div><img class="c" alt="Εξώφυλλο του Η γλώσσα των δράκων" src="/covers/1.jpg">
    <a href="/βιβλίο/1/x" class="book-title fw-bold">Η γλώσσα των δράκων</a>
    <a href="/συγγραφέας/2" class="text-color-secondary">S. F. Williamson</a>
    <span>ISBN: 978-618-10-0185-2</span></div>`;
  const variant = `<article><img src='https://x/c.jpg' alt='Cover of dragons'>
    <h3><a class='title-link' href='/book/9'>Η γλώσσα των <b>δράκων</b></a></h3>
    <p>από <a href='/author/5' class='link'>S. F. Williamson</a></p>
    <div>ISBN-13 9786181001852</div></article>`;
  const fallback = `<img data-x="1" src="/c.jpg" alt="Εξώφυλλο της Κάτι άλλο">
    <a class="author-name" href="/p/1">Κώστας Κρομμύδας</a>`;

  it("parses the classic layout", () => {
    const [b] = parseBiblionetBooks(classic, 5);
    expect(b.title).toBe(TITLE);
    expect(b.author).toBe("S. F. Williamson");
    expect(normalizeIsbn(b.isbn)).toBe("9786181001852");
    expect(b.coverUrl).toBe("https://www.biblionet.gr/covers/1.jpg");
  });
  it("parses alternate classes, quotes and ISBN labels", () => {
    const [b] = parseBiblionetBooks(variant, 5);
    expect(b.title).toBe(TITLE);
    expect(b.author).toBe("S. F. Williamson");
    expect(b.isbn).toBe("9786181001852");
  });
  it("falls back to alt text for the title", () => {
    const [b] = parseBiblionetBooks(fallback, 5);
    expect(b.title).toBe("Κάτι άλλο");
    expect(b.author).toBe("Κώστας Κρομμύδας");
  });
  it("respects limits, dedupes and handles empty/garbage input", () => {
    expect(parseBiblionetBooks(classic + variant + fallback, 1)).toHaveLength(1);
    expect(parseBiblionetBooks(classic + variant, 5)).toHaveLength(1);
    expect(parseBiblionetBooks("", 5)).toEqual([]);
    expect(parseBiblionetBooks("<img alt='logo'><a>x</a>", 5)).toEqual([]);
  });
});
