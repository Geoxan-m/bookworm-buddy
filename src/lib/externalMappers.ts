/** Pure mappers from Google Books / Open Library payloads to Book. Never invent metadata. */
import type { Book } from "./books";
import { normalizeLanguage, validYear } from "./workIdentity";

export type GBVolume = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publisher?: string;
    categories?: string[];
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    publishedDate?: string;
    description?: string;
    language?: string;
    ratingsCount?: number;
  };
};

export type OLDoc = {
  key: string;
  title?: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  first_publish_year?: number;
  subject?: string[];
  publisher?: string[];
  language?: string[];
  ratings_count?: number;
  readinglog_count?: number;
  edition_count?: number;
};

/** log10(1+n) of a real, non-negative provider count; undefined when absent. */
export function popularityFrom(...counts: (number | undefined)[]): number | undefined {
  const valid = counts.filter(
    (c): c is number => typeof c === "number" && Number.isFinite(c) && c >= 0,
  );
  return valid.length ? Math.log10(1 + Math.max(...valid)) : undefined;
}

const clip = (s: string | undefined, n: number) => (s ?? "").trim().slice(0, n);

const PLACEHOLDER_AUTHORS = new Set([
  "unknown",
  "unknown author",
  "anonymous",
  "anon",
  "n a",
  "na",
  "none",
  "null",
  "undefined",
  "various",
  "-",
  "",
  "αγνωστοσ",
  "αγνωστοσ συγγραφεασ",
  "ανωνυμοσ",
  "συλλογικο",
]);

/** True for blank-like or fallback author strings that are not real metadata. */
export function isPlaceholderAuthor(a: string | null | undefined): boolean {
  const n = (a ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ς/g, "σ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return PLACEHOLDER_AUTHORS.has(n) || !/[\p{L}]/u.test(n);
}

/** Real author or "" — never a placeholder. */
export function cleanAuthor(a: string | null | undefined): string {
  const c = clip(a ?? undefined, 200);
  return isPlaceholderAuthor(c) ? "" : c;
}

/** Only https URLs survive; http Google thumbnails are upgraded, anything else dropped. */
export function safeCover(url: string | undefined): string {
  if (!url) return "";
  const u = url.trim().replace(/^http:\/\//i, "https://");
  try {
    return new URL(u).protocol === "https:" ? u.slice(0, 500) : "";
  } catch {
    return "";
  }
}

/**
 * Edition year from a structurally valid source date: "YYYY", "YYYY-MM" or "YYYY-MM-DD".
 * Month/day must be real calendar values and the year must not be beyond next year.
 * Anything else (e.g. "circa 1990", "2023-13", "2023-02-30") returns null.
 */
export function yearFromDate(d: string | undefined, now = new Date()): number | null {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec((d ?? "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  if (m[2]) {
    const mo = Number(m[2]);
    if (mo < 1 || mo > 12) return null;
    if (m[3]) {
      const day = Number(m[3]);
      const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      if (day < 1 || day > last) return null;
    }
  }
  return plausibleYear(y, now);
}

/** validYear plus "not more than one year in the future". */
export function plausibleYear(y: unknown, now = new Date()): number | null {
  const v = validYear(y);
  return v !== null && v <= now.getUTCFullYear() + 1 ? v : null;
}

function optional(b: Book, k: "publisher" | "publishedYear" | "languageCode", v: unknown) {
  if (v !== null && v !== undefined && v !== "") (b as Record<string, unknown>)[k] = v;
}

export function mapGoogleVolume(it: GBVolume): Book {
  const v = it.volumeInfo ?? {};
  const isbn =
    v.industryIdentifiers?.find((x) => x.type === "ISBN_13")?.identifier ??
    v.industryIdentifiers?.find((x) => x.type === "ISBN_10")?.identifier ??
    "";
  const cover =
    safeCover(v.imageLinks?.thumbnail) ||
    safeCover(v.imageLinks?.smallThumbnail) ||
    (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : "");
  const b: Book = {
    id: `gb:${it.id}`,
    isbn,
    title: clip(v.title, 300) || "Untitled",
    author: cleanAuthor(v.authors?.[0]),
    genre: v.categories?.[0]?.slice(0, 30) ?? "—",
    coverUrl: cover,
    description: v.description?.slice(0, 240) ?? v.publishedDate ?? "",
  };
  const pop = popularityFrom(v.ratingsCount);
  if (pop !== undefined) b.popularity = pop;
  optional(b, "publisher", clip(v.publisher, 200));
  optional(b, "publishedYear", yearFromDate(v.publishedDate));
  optional(b, "languageCode", normalizeLanguage(v.language));
  return b;
}

/**
 * Open Library search docs describe a *work* across many editions, so publisher and
 * language are kept only when there is exactly one value. first_publish_year is the
 * work's first publication, not this edition's year, so it is not stored as published_year.
 */
export function mapOpenLibraryDoc(d: OLDoc): Book {
  const isbn = d.isbn?.[0] ?? "";
  const cover = d.cover_i
    ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`
    : isbn
      ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
      : "";
  // first_publish_year is a *work* fact: shown in the description only, never as published_year.
  const b: Book = {
    id: d.key,
    isbn,
    title: clip(d.title, 300) || "Untitled",
    author: cleanAuthor(d.author_name?.[0]),
    genre: d.subject?.[0]?.slice(0, 30) ?? "—",
    coverUrl: cover,
    description: d.first_publish_year ? `First published ${d.first_publish_year}` : "",
  };
  const pop = popularityFrom(d.ratings_count, d.readinglog_count, d.edition_count);
  if (pop !== undefined) b.popularity = pop;
  if (d.publisher?.length === 1) optional(b, "publisher", clip(d.publisher[0], 200));
  if (d.language?.length === 1) optional(b, "languageCode", normalizeLanguage(d.language[0]));
  return b;
}

export type ExternalRef = { source: "google"; id: string } | { source: "openlibrary"; id: string };

const GB_ID = /^[A-Za-z0-9_-]{6,20}$/;
const OL_KEY = /^\/works\/OL\d{1,10}W$/;

/** Validates a source reference. Returns null for anything not strictly well-formed. */
export function parseExternalRef(input: unknown): ExternalRef | null {
  if (!input || typeof input !== "object") return null;
  const { source, id } = input as { source?: unknown; id?: unknown };
  if (typeof id !== "string") return null;
  if (source === "google" && GB_ID.test(id)) return { source, id };
  if (source === "openlibrary" && OL_KEY.test(id)) return { source, id };
  return null;
}

/** Derive a reference from a search result's id ("gb:<id>" or "/works/OL…W"). */
export function refFromBook(b: Pick<Book, "id">): ExternalRef | null {
  if (b.id.startsWith("gb:")) return parseExternalRef({ source: "google", id: b.id.slice(3) });
  return parseExternalRef({ source: "openlibrary", id: b.id });
}
