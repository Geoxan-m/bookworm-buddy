/** Greek-aware text normalization shared by search matching and deduplication. */

const LEADING_ARTICLES = new Set(["ο", "η", "το", "οι", "τα", "ενασ", "μια", "ενα"]);

/** NFKD + lowercase + strip diacritics + final sigma + punctuation/whitespace cleanup. */
export function normalizeGreek(value: string): string {
  return (value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ς/g, "σ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalized text with one leading Greek article removed (if present and not the only word). */
export function stripLeadingArticle(value: string): string {
  const n = normalizeGreek(value);
  const [first, ...rest] = n.split(" ");
  return rest.length && LEADING_ARTICLES.has(first) ? rest.join(" ") : n;
}

function isbn10to13(isbn10: string): string {
  const core = `978${isbn10.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 ? 3 : 1);
  return core + ((10 - (sum % 10)) % 10);
}

/** Digits/X only; ISBN-10 upgraded to ISBN-13 so both forms compare equal. "" if not an ISBN. */
export function normalizeIsbn(value: string): string {
  const raw = (value ?? "").replace(/[^0-9xX]/g, "").toUpperCase();
  if (/^\d{13}$/.test(raw)) return raw;
  if (/^\d{9}[\dX]$/.test(raw)) return isbn10to13(raw);
  return "";
}

export function looksLikeIsbn(value: string): boolean {
  return /^[\d\s\-xX]+$/.test(value.trim()) && normalizeIsbn(value) !== "";
}

/** Small bounded set of query variants: original, normalized, article-less, ISBN. */
export function queryVariants(query: string, max = 4): string[] {
  const q = query.trim().replace(/\s+/g, " ");
  if (!q) return [];
  if (looksLikeIsbn(q)) return [normalizeIsbn(q)];
  const out = new Set<string>([q, normalizeGreek(q), stripLeadingArticle(q)]);
  return [...out].filter((v) => v.length >= 3).slice(0, max);
}

/** Dedup key: normalized ISBN first, else article-less title + normalized author. */
export function bookKey(b: { isbn?: string; title: string; titleEl?: string; author: string }) {
  const isbn = normalizeIsbn(b.isbn ?? "");
  if (isbn) return `isbn:${isbn}`;
  return `ta:${stripLeadingArticle(b.titleEl || b.title)}|${normalizeGreek(b.author)}`;
}
