/** Deterministic work / edition / series identity helpers. Reuses greekNormalize rules. */
import { normalizeGreek, normalizeIsbn, stripLeadingArticle } from "./greekNormalize";

export type IdentityInput = {
  isbn?: string | null;
  title: string;
  author?: string | null;
  publisher?: string | null;
  publishedYear?: number | null;
  languageCode?: string | null;
};

/** Normalized ISO-ish language code ("EL", "el-GR" -> "el"); null if absent or malformed. */
export function normalizeLanguage(code: string | null | undefined): string | null {
  const m = /^([a-z]{2,3})(?:[-_][a-z0-9]+)?$/i.exec((code ?? "").trim());
  return m ? m[1].toLowerCase() : null;
}

/** Valid publication year or null. Mirrors the database constraint. */
export function validYear(y: unknown): number | null {
  const n = typeof y === "string" ? Number(y.trim()) : y;
  return typeof n === "number" && Number.isInteger(n) && n >= 1000 && n <= 2200 ? n : null;
}

/** Provisional work identity: article-less title + author. Independent of ISBN/edition. */
export function workKey(b: IdentityInput): string | null {
  const t = stripLeadingArticle(b.title || "");
  if (!t) return null;
  return `w:${t}|${normalizeGreek(b.author || "")}`;
}

/** Edition identity: normalized ISBN, else title+author+publisher/year/language when known. */
export function editionKey(b: IdentityInput): string | null {
  const isbn = normalizeIsbn(b.isbn || "");
  if (isbn) return `isbn:${isbn}`;
  const w = workKey(b);
  if (!w) return null;
  const pub = normalizeGreek(b.publisher || "");
  const year = validYear(b.publishedYear) ?? "";
  const lang = normalizeLanguage(b.languageCode) ?? "";
  return `e:${w.slice(2)}|${pub}|${year}|${lang}`;
}

/** Normalized series title (accents, case, final sigma, punctuation); null if empty. */
export function normalizeSeriesTitle(title: string | null | undefined): string | null {
  const n = normalizeGreek(title || "");
  return n || null;
}

/**
 * Conservative volume parser. Accepts "3", "2.5", "2,5", "#3", "Vol. 3", "Τόμος 3", "Βιβλίο 2".
 * Rejects ranges, roman numerals, words, multiple numbers and out-of-range values.
 */
export function parseSeriesNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 && value < 10000 ? value : null;
  }
  const s = (value ?? "").trim();
  if (!s) return null;
  const m =
    /^(?:#|no\.?|vol\.?|volume|book|τομοσ|τόμοσ|τόμος|τομος|βιβλιο|βιβλίο|μέροσ|μέρος|μεροσ|μερος)?\s*(\d{1,4}(?:[.,]\d{1,2})?)$/iu.exec(
      s,
    );
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return n > 0 && n < 10000 ? n : null;
}
