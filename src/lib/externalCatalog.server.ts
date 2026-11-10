/** Server-only: re-fetch a Google Books / Open Library record by ID from its own origin. */
import type { Book } from "./books";
import { isValidBook } from "./catalog";
import {
  mapGoogleVolume,
  mapOpenLibraryDoc,
  type ExternalRef,
  type GBVolume,
  type OLDoc,
} from "./externalMappers";

export const ALLOWED_ORIGINS = ["https://www.googleapis.com", "https://openlibrary.org"];
export const MAX_BYTES = 300_000;
export const TIMEOUT_MS = 4000;

export function urlForRef(ref: ExternalRef): string {
  if (ref.source === "google")
    return `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(ref.id)}`;
  const fields = "key,title,author_name,isbn,cover_i,first_publish_year,subject,publisher,language";
  return `https://openlibrary.org/search.json?q=${encodeURIComponent(`key:${ref.id}`)}&limit=1&fields=${fields}`;
}

export type FetchFailure = "origin" | "transport" | "http" | "timeout" | "oversized" | "json";
export type JsonResult = { ok: true; data: unknown } | { ok: false; reason: FetchFailure };

/** Stream and count actual bytes; never buffer an oversized provider response. */
export async function fetchJsonResult(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<JsonResult> {
  try {
    if (!ALLOWED_ORIGINS.includes(new URL(url).origin)) return { ok: false, reason: "origin" };
  } catch {
    return { ok: false, reason: "origin" };
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      signal: ctl.signal,
      redirect: "error",
      headers: { "User-Agent": "BookwormBuddy/1.0" },
    });
    if (!res.ok) return { ok: false, reason: "http" };
    if (Number(res.headers.get("content-length") || 0) > MAX_BYTES) {
      await res.body?.cancel();
      return { ok: false, reason: "oversized" };
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          return { ok: false, reason: "oversized" };
        }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return { ok: true, data: JSON.parse(new TextDecoder().decode(bytes)) };
    } catch {
      return { ok: false, reason: "json" };
    }
  } catch {
    return { ok: false, reason: ctl.signal.aborted ? "timeout" : "transport" };
  } finally {
    clearTimeout(timer);
  }
}

/** Compatibility wrapper for verified single-record fetching. */
export async function fetchLimitedJson(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown | null> {
  const result = await fetchJsonResult(url, fetchImpl);
  return result.ok ? result.data : null;
}

/** Returns a validated Book whose data came from the source itself, or null. */
export async function fetchVerifiedBook(
  ref: ExternalRef,
  fetchImpl: typeof fetch = fetch,
): Promise<{ book: Book; sourceUrl: string } | null> {
  const url = urlForRef(ref);
  const json = await fetchLimitedJson(url, fetchImpl);
  if (!json || typeof json !== "object") return null;
  let book: Book | null = null;
  if (ref.source === "google") {
    const v = json as GBVolume;
    if (v.id !== ref.id) return null;
    book = mapGoogleVolume(v);
  } else {
    const doc = (json as { docs?: OLDoc[] }).docs?.[0];
    if (!doc || doc.key !== ref.id) return null;
    book = mapOpenLibraryDoc(doc);
  }
  if (!isValidBook(book) || book.title === "Untitled") return null;
  const sourceUrl =
    ref.source === "google"
      ? `https://books.google.com/books?id=${encodeURIComponent(ref.id)}`
      : `https://openlibrary.org${ref.id}`;
  return { book, sourceUrl };
}
