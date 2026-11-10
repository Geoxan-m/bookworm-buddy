import { normalizeLanguage } from "./workIdentity";
import { plausibleYear } from "./externalMappers";
import type { Book } from "@/lib/books";
import {
  looksLikeIsbn,
  normalizeGreek,
  normalizeIsbn,
  queryVariants,
  stripLeadingArticle,
} from "@/lib/greekNormalize";
import { dedupeBooks } from "@/lib/searchBooks";
import { latinToGreekQuery } from "@/lib/greeklish";

const BIBLIONET_BASE = "https://www.biblionet.gr";

const LATIN_TO_GREEK_AUTHOR_ALIASES: Array<{ needle: string; queries: string[] }> = [
  { needle: "krom", queries: ["Κώστας Κρομμύδας", "Κρομμύδας"] },
  { needle: "kromm", queries: ["Κώστας Κρομμύδας", "Κρομμύδας"] },
  { needle: "ntagg", queries: ["Μιχάλης Νταγγίνης", "Νταγγίνης"] },
  { needle: "dagg", queries: ["Μιχάλης Νταγγίνης", "Νταγγίνης"] },
  { needle: "nagg", queries: ["Μιχάλης Νταγγίνης", "Νταγγίνης", "Νίκη Καναγκίνη"] },
  { needle: "alexiad", queries: ["Στέφανος Αλεξιάδης", "Μηνάς Αλεξιάδης", "Αλεξιάδης"] },
];

const GREEK_AUTHOR_ALIASES: Array<{ needle: string; queries: string[] }> = [
  { needle: "κρομμυδ", queries: ["Κώστας Κρομμύδας", "Κρομμύδας"] },
  { needle: "νταγγιν", queries: ["Μιχάλης Νταγγίνης", "Νταγγίνης"] },
  { needle: "ναγγιν", queries: ["Μιχάλης Νταγγίνης", "Νταγγίνης", "Νίκη Καναγκίνη"] },
  { needle: "αλεξιαδ", queries: ["Στέφανος Αλεξιάδης", "Μηνάς Αλεξιάδης", "Αλεξιάδης"] },
];

const normalizeText = normalizeGreek;

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${BIBLIONET_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** Bounded query set: aliases first, then original/normalized/article-less/ISBN variants. Max 4. */
export function expandQueries(query: string): string[] {
  const variants = queryVariants(query);
  if (looksLikeIsbn(query)) return variants;
  const normalized = normalizeText(query);
  const out = new Set<string>();
  for (const alias of [...GREEK_AUTHOR_ALIASES, ...LATIN_TO_GREEK_AUTHOR_ALIASES]) {
    if (normalized.includes(alias.needle)) alias.queries.slice(0, 2).forEach((q) => out.add(q));
  }
  variants.forEach((v) => out.add(v));
  // One deterministic Greek spelling for Latin/Greeklish queries (stays within the cap).
  const greek = latinToGreekQuery(query);
  const list = [...out].filter((q) => q.trim().length >= 3).slice(0, greek ? 3 : 4);
  if (greek && !list.includes(greek)) list.push(greek);
  return list.slice(0, 4);
}

async function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "BookwormBuddy/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

const MAX_HTML = 600_000;
const stripTags = (v: string) => decodeHtml(v.replace(/<[^>]+>/g, " "));
const attr = (attrs: string, name: string) =>
  attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "";

/**
 * Tolerant Biblionet parser: blocks start at each cover image (alt "Εξώφυλλο…" or
 * "cover…", any attribute order). Title = anchor whose class contains "title" or links
 * to a book page, falling back to the alt text. Author = anchor with a secondary/author
 * class or author/person link. ISBN via ISBN(-10/-13) label anywhere in the block.
 */
/**
 * Labelled metadata only ("Εκδότης:", "Έτος έκδοσης:", "Σειρά:", "Γλώσσα:"); absent labels => absent fields.
 */
export function parseBiblionetMeta(text: string): Partial<Book> {
  const out: Partial<Book> = {};
  const grab = (re: RegExp) => text.match(re)?.[1]?.trim().slice(0, 200) ?? "";
  const stop = String.raw`(?=\s+ISBN|\s+(?:Εκδότης|Εκδοτης|Έτος|Ετος|Σειρά|Σειρα|Γλώσσα|Γλωσσα|Publisher|Year|Series|Language)[^:：]{0,12}[:：]|$)`;
  const publisher = grab(
    new RegExp(String.raw`(?:Εκδότης|Εκδοτης|Publisher)\s*[:：]\s*(.+?)` + stop, "iu"),
  );
  if (publisher) out.publisher = publisher;
  const year = plausibleYear(
    Number(grab(/(?:Έτος(?: έκδοσης)?|Ετος(?: εκδοσης)?|Year)\s*[:：]\s*(\d{4})\b/iu)),
  );
  if (year) out.publishedYear = year;
  const series = grab(new RegExp(String.raw`(?:Σειρά|Σειρα|Series)\s*[:：]\s*(.+?)` + stop, "iu"));
  if (series) {
    const m = /^(.*?)[\s,;]+(?:#|αρ\.?|τόμος|τομος|vol\.?)\s*(\d{1,4}(?:[.,]\d{1,2})?)$/iu.exec(
      series,
    );
    out.series = (m ? m[1] : series).trim();
    if (m) out.seriesNumber = m[2];
  }
  const lang = normalizeLanguage(
    grab(/(?:Γλώσσα|Γλωσσα|Language)\s*[:：]\s*([a-z]{2,3}(?:-[a-z]{2})?)\b/iu),
  );
  if (lang) out.languageCode = lang;
  return out;
}

export function parseBiblionetBooks(htmlIn: string, limit: number): Book[] {
  const html = (htmlIn || "").slice(0, MAX_HTML);
  const books: Book[] = [];
  const seen = new Set<string>();
  const imgs = [...html.matchAll(/<img\b([^>]*)>/gi)].filter(([, a]) =>
    /alt\s*=\s*["'][^"']*(εξώφυλλο|εξωφυλλο|cover)/i.test(a),
  );

  for (let i = 0; i < imgs.length && books.length < limit; i++) {
    const [, imgAttrs] = imgs[i];
    const start = imgs[i].index ?? 0;
    const end = imgs[i + 1]?.index ?? Math.min(start + 6000, html.length);
    const block = html.slice(start, end);
    const anchors = [...block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(([, a, inner]) => ({
      cls: attr(a, "class"),
      href: attr(a, "href"),
      text: stripTags(inner),
    }));
    const titleA =
      anchors.find((x) => /title/i.test(x.cls) && x.text) ??
      anchors.find((x) => /(\/book\/|βιβλ|%ce%b2%ce%b9%ce%b2%ce%bb)/i.test(x.href) && x.text);
    const authorA = anchors.find(
      (x) =>
        x !== titleA &&
        x.text &&
        (/(secondary|author|contributor|writer)/i.test(x.cls) ||
          /(author|person|contributor|συγγραφ|%cf%83%cf%85%ce%b3%ce%b3%cf%81%ce%b1%cf%86)/i.test(
            x.href,
          )),
    );
    const altTitle = decodeHtml(attr(imgAttrs, "alt")).replace(
      /^(εξώφυλλο|εξωφυλλο|cover)\s*(του|της|of)?\s*/i,
      "",
    );
    const title = titleA?.text || altTitle;
    const author = authorA?.text ?? "";
    if (!title || !author) continue;

    const isbnRaw =
      stripTags(block).match(
        /ISBN(?:-1[03])?\s*[:：]?\s*([0-9Xx][0-9Xx\-\s]{8,16}[0-9Xx])/i,
      )?.[1] ?? "";
    const isbn = isbnRaw.replace(/\s+/g, "");
    const href = absoluteUrl(decodeHtml(titleA?.href ?? ""));
    const coverUrl = absoluteUrl(decodeHtml(attr(imgAttrs, "src") || attr(imgAttrs, "data-src")));
    const key = normalizeIsbn(isbn) || `${stripLeadingArticle(title)}|${normalizeText(author)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const meta = parseBiblionetMeta(stripTags(block));
    books.push({
      ...meta,
      id: `bn:${href || key}`,
      isbn,
      title,
      titleEl: title,
      author,
      genre: "Ελληνική λογοτεχνία",
      coverUrl,
      description: href,
      descriptionEl: isbn ? `ISBN: ${isbn}` : "ΒιβλιοΝετ",
    });
  }
  return books;
}

async function searchBiblionetOnce(
  query: string,
  filter: "books" | "contributor_titles",
  limit: number,
) {
  const url = `${BIBLIONET_BASE}/%CF%83%CF%85%CE%BD%CE%B8%CE%B5%CF%84%CE%B7-%CE%B1%CE%BD%CE%B1%CE%B6%CE%B7%CF%84%CE%B7%CF%83%CE%B7?preselect_filter=${filter}&q=${encodeURIComponent(query)}`;
  const html = await fetchWithTimeout(url, 4500);
  return parseBiblionetBooks(html, limit);
}

type Fetcher = (
  q: string,
  filter: "books" | "contributor_titles",
  limit: number,
) => Promise<Book[]>;

/** All query × filter requests run in parallel; merged in priority order. */
export async function searchGreekBibliography(
  query: string,
  limit: number,
  fetcher: Fetcher = searchBiblionetOnce,
): Promise<Book[]> {
  const queries = expandQueries(query);
  const filters = looksLikeIsbn(query)
    ? (["books"] as const)
    : (["contributor_titles", "books"] as const);
  const jobs = queries.flatMap((q) => filters.map((f) => fetcher(q, f, limit).catch(() => [])));
  const batches = await Promise.all(jobs);
  return dedupeBooks(batches.flat()).slice(0, limit);
}
