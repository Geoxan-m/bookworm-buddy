import type { Book } from "./books";
import type { BookStatus } from "./libraryStore";
import { bookKey, normalizeIsbn } from "./greekNormalize";

export type ManualInput = {
  title: string;
  author: string;
  isbn?: string;
  genre?: string;
  coverUrl?: string;
  status?: BookStatus;
};

export type ManualErrors = Partial<Record<"title" | "author" | "isbn" | "coverUrl", string>>;

export const MANUAL_STATUSES: BookStatus[] = ["current", "read", "want", "buy"];

/** Returns error keys (i18n) per field; empty object when valid. */
export function validateManual(i: ManualInput): ManualErrors {
  const e: ManualErrors = {};
  const title = i.title.trim();
  const author = i.author.trim();
  if (!title) e.title = "manual_err_required";
  else if (title.length > 300) e.title = "manual_err_too_long";
  if (!author) e.author = "manual_err_required";
  else if (author.length > 200) e.author = "manual_err_too_long";
  if (i.isbn?.trim() && !normalizeIsbn(i.isbn)) e.isbn = "manual_err_isbn";
  const c = i.coverUrl?.trim();
  if (c) {
    try {
      const u = new URL(c);
      if (u.protocol !== "https:" || c.length > 1000) e.coverUrl = "manual_err_https";
    } catch {
      e.coverUrl = "manual_err_https";
    }
  }
  return e;
}

/** Stable, collision-resistant ID: same ISBN/title+author → same ID (no duplicates). */
export function manualId(i: Pick<ManualInput, "title" | "author" | "isbn">): string {
  const key = bookKey({ isbn: i.isbn ?? "", title: i.title, author: i.author });
  // FNV-1a 64-bit over the normalized key.
  let h = 0xcbf29ce484222325n;
  for (const ch of new TextEncoder().encode(key)) {
    h ^= BigInt(ch);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return `manual:${h.toString(36)}`;
}

export function buildManualBook(i: ManualInput): Book {
  return {
    id: manualId(i),
    isbn: normalizeIsbn(i.isbn ?? ""),
    title: i.title.trim(),
    author: i.author.trim(),
    genre: (i.genre ?? "").trim().slice(0, 60),
    coverUrl: (i.coverUrl ?? "").trim(),
    description: "",
  };
}

/** Finds an existing library book with the same normalized identity. */
export function findDuplicate(book: Book, library: Book[]): Book | undefined {
  const k = bookKey(book);
  return library.find((b) => b.id === book.id || bookKey(b) === k);
}

/** Wraps an async submit so concurrent calls while one is pending are ignored. */
export function onceAtATime<A extends unknown[]>(fn: (...a: A) => Promise<void> | void) {
  let busy = false;
  return async (...a: A) => {
    if (busy) return false;
    busy = true;
    try {
      await fn(...a);
      return true;
    } finally {
      busy = false;
    }
  };
}
