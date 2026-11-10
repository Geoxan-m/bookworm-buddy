/** Server-only: bounded Google Books + Open Library search (never called from the browser). */
import type { Book } from "./books";
import { mapGoogleVolume, mapOpenLibraryDoc, type GBVolume, type OLDoc } from "./externalMappers";
import { fetchJsonResult } from "./externalCatalog.server";
import { phraseAliases } from "./searchRank";
import { looksLikeIsbn } from "./greekNormalize";
import { dedupeBooks } from "./searchBooks";
import { isValidBook } from "./catalog";

export const MAX_PROVIDER_REQUESTS = 6;
export const MAX_POOL = 30;

const GR_MAP: Record<string, string> = {
  α: "a",
  ά: "a",
  β: "v",
  γ: "g",
  δ: "d",
  ε: "e",
  έ: "e",
  ζ: "z",
  η: "i",
  ή: "i",
  θ: "th",
  ι: "i",
  ί: "i",
  ϊ: "i",
  ΐ: "i",
  κ: "k",
  λ: "l",
  μ: "m",
  ν: "n",
  ξ: "x",
  ο: "o",
  ό: "o",
  π: "p",
  ρ: "r",
  σ: "s",
  ς: "s",
  τ: "t",
  υ: "y",
  ύ: "y",
  ϋ: "y",
  ΰ: "y",
  φ: "f",
  χ: "ch",
  ψ: "ps",
  ω: "o",
  ώ: "o",
};

export function transliterateGreek(s: string): string {
  return [...s.toLowerCase()].map((ch) => GR_MAP[ch] ?? ch).join("");
}
const hasGreek = (s: string) => /[\u0370-\u03ff\u1f00-\u1fff]/.test(s);
const numeric = (s: string) => /\d/.test(s) || looksLikeIsbn(s);

/** Provider URLs for one query: at most 6, only allow-listed origins. */
export function providerUrls(query: string, limit = 10): string[] {
  const q = query.trim();
  if (!q) return [];
  const n = Math.min(Math.max(limit, 1), 10);
  const queries = [q];
  if (!numeric(q) && hasGreek(q)) {
    const tr = transliterateGreek(q);
    if (tr !== q) queries.push(tr);
  }
  const googleFields =
    "totalItems,items(id,volumeInfo(title,authors,publisher,categories,industryIdentifiers,imageLinks,publishedDate,language,ratingsCount))";
  const openFields = "key,title,author_name,isbn,cover_i,first_publish_year,edition_count";
  const gb = (x: string) =>
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(x)}&maxResults=${n}&printType=books&fields=${encodeURIComponent(googleFields)}`;
  const ol = (x: string, field = "q") =>
    `https://openlibrary.org/search.json?${field}=${encodeURIComponent(x)}&limit=${n}&fields=${openFields}`;
  const titleQ = phraseAliases(q).at(-1) ?? q;
  const urls = [
    ...queries.map(gb),
    ...queries.map((x) => ol(x)),
    gb(`intitle:${titleQ}`),
    ol(titleQ, "title"),
  ];
  return [...new Set(urls)].slice(0, MAX_PROVIDER_REQUESTS);
}

export class ProviderSearchError extends Error {
  constructor(public reasons: string[]) {
    super("all_providers_failed");
  }
}

function mapResponse(url: string, json: unknown): Book[] | null {
  if (!json || typeof json !== "object") return null;
  const google = url.startsWith("https://www.googleapis.com/");
  const payload = json as { items?: GBVolume[]; docs?: OLDoc[]; totalItems?: number };
  const items = google ? payload.items : payload.docs;
  if (google && payload.totalItems === 0 && items === undefined) return [];
  if (!Array.isArray(items)) return null;
  if (
    items.some(
      (item) =>
        !item ||
        typeof item !== "object" ||
        (google
          ? typeof (item as GBVolume).id !== "string" ||
            typeof (item as GBVolume).volumeInfo?.title !== "string"
          : typeof (item as OLDoc).key !== "string" || typeof (item as OLDoc).title !== "string"),
    )
  )
    return null;
  try {
    return items
      .slice(0, 10)
      .map((item) =>
        google ? mapGoogleVolume(item as GBVolume) : mapOpenLibraryDoc(item as OLDoc),
      );
  } catch {
    return null;
  }
}

/** Fetch all provider URLs in parallel (≤6), validate, dedupe, cap the pool at 30. */
export async function searchInternational(
  query: string,
  limit = 10,
  fetchImpl: typeof fetch = fetch,
): Promise<Book[]> {
  const urls = providerUrls(query, limit);
  const failures: string[] = [];
  const results = await Promise.all(
    urls.map(async (u) => {
      const response = await fetchJsonResult(u, fetchImpl);
      if (!response.ok) {
        failures.push(response.reason);
        return null;
      }
      const books = mapResponse(u, response.data);
      if (books === null) failures.push("schema");
      return books;
    }),
  );
  if (urls.length && results.every((r) => r === null)) throw new ProviderSearchError(failures);
  return dedupeBooks(
    results
      .filter((r): r is Book[] => r !== null)
      .flat()
      .filter((b) => isValidBook(b) && b.title !== "Untitled"),
  ).slice(0, MAX_POOL);
}
