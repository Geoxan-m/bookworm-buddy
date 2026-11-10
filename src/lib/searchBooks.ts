/** Pure, browser-safe dedupe/merge helpers. Provider fetching lives in intlBooks.server.ts. */
import type { Book } from "./books";
import { normalizeGreek, normalizeIsbn, stripLeadingArticle } from "./greekNormalize";
import { crossScriptKey } from "./greeklish";

const blank = (v: unknown) => v == null || (typeof v === "string" && !v.trim());

/** Fill blank fields of `keep` from `extra`; keep's real values always win. */
export function mergeBookMetadata(keep: Book, extra: Book): Book {
  const out: Book = { ...keep };
  const o = out as Record<string, unknown>;
  for (const [k, v] of Object.entries(extra)) {
    if (k === "id" || blank(v)) continue;
    if (k === "coverUrl" && !/^https:\/\//.test(String(v))) continue;
    if (k === "isbn" && !normalizeIsbn(String(v))) continue;
    if (k === "publishedYear" && !(Number.isInteger(v) && (v as number) > 0)) continue;
    if (k === "description") {
      if (String(v).length > String(o.description ?? "").length) o.description = v;
      continue;
    }
    if (k === "popularity") {
      o.popularity = Math.max(Number(o.popularity ?? 0), Number(v));
      continue;
    }
    if (blank(o[k])) o[k] = v;
  }
  return out;
}

/**
 * Dedupe: exact normalized ISBN first; otherwise identical normalized title+author,
 * or matching cross-script (Greeklish) title+author skeletons. Two books with
 * different ISBNs are never merged by title/author (distinct editions). Earlier wins;
 * blanks are filled from later duplicates.
 */
export function dedupeBooks(books: Book[]): Book[] {
  const out: Book[] = [];
  const byIsbn = new Map<string, number>();
  const byKey = new Map<string, number>();
  for (const b of books) {
    const isbn = normalizeIsbn(b.isbn || "");
    const title = stripLeadingArticle(b.titleEl || b.title);
    if (!title) continue;
    const keys = [`ta:${title}|${normalizeGreek(b.author)}`];
    const cross = crossScriptKey(b.titleEl || b.title, b.author || "");
    const script = /[α-ω]/.test(normalizeGreek(`${b.titleEl || b.title} ${b.author}`))
      ? "gr"
      : "lat";
    // Cross-script keys only match entries written in the other script.
    const lookups = [...keys];
    if (cross) lookups.push(`x:${script === "gr" ? "lat" : "gr"}:${cross}`);
    let hit = isbn ? byIsbn.get(isbn) : undefined;
    if (hit === undefined)
      for (const k of lookups) {
        const i = byKey.get(k);
        if (i === undefined) continue;
        const other = normalizeIsbn(out[i].isbn || "");
        if (isbn && other && other !== isbn) continue;
        hit = i;
        break;
      }
    if (hit !== undefined) {
      out[hit] = mergeBookMetadata(out[hit], b);
      const merged = normalizeIsbn(out[hit].isbn || "");
      if (merged && !byIsbn.has(merged)) byIsbn.set(merged, hit);
      continue;
    }
    const idx = out.push(b) - 1;
    if (isbn) byIsbn.set(isbn, idx);
    if (cross) keys.push(`x:${script}:${cross}`);
    for (const k of keys) if (!byKey.has(k)) byKey.set(k, idx);
  }
  return out;
}
