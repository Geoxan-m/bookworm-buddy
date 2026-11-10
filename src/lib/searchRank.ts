/** Deterministic search ranking for suggestions. Pure; no network. */
import type { Book } from "./books";
import { looksLikeIsbn, normalizeGreek, normalizeIsbn } from "./greekNormalize";
import { greeklishSkeleton } from "./greeklish";

const GR_TO_LATIN: Record<string, string> = {
  α: "a",
  β: "v",
  γ: "g",
  δ: "d",
  ε: "e",
  ζ: "z",
  η: "i",
  θ: "th",
  ι: "i",
  κ: "k",
  λ: "l",
  μ: "m",
  ν: "n",
  ξ: "x",
  ο: "o",
  π: "p",
  ρ: "r",
  σ: "s",
  ς: "s",
  τ: "t",
  υ: "y",
  φ: "f",
  χ: "ch",
  ψ: "ps",
  ω: "o",
};

/** Max comparison forms per string: plain, Latin transliteration, Greeklish skeleton. */
export const MAX_FORMS = 3;

/**
 * Normalized forms: Greek-normalized, a Latin transliteration when it differs, and
 * (unless `strict`) the script-independent Greeklish skeleton. Bounded to MAX_FORMS.
 */
export function forms(s: string, strict = false): string[] {
  const plain = normalizeGreek(s);
  const latin = plain.replace(/[α-ω]/g, (ch) => GR_TO_LATIN[ch] ?? ch);
  const out = new Set([plain, latin]);
  if (!strict) out.add(greeklishSkeleton(plain));
  return [...out].filter(Boolean).slice(0, MAX_FORMS);
}

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** English words for a plain integer 0–100 ("50" -> "fifty"); null otherwise. */
export function numberAlias(q: string): string | null {
  const t = q.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  if (n > 100) return null;
  if (n === 100) return "one hundred";
  if (n < 20) return ONES[n];
  return n % 10 ? `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}` : TENS[n / 10];
}

/** Bounded phrase aliases; ISBNs are never rewritten. */
export function phraseAliases(query: string): string[] {
  const q = normalizeGreek(query);
  if (looksLikeIsbn(query)) return [q];
  const numbered = q.replace(/\b\d{1,3}\b/g, (n) => numberAlias(n) ?? n);
  return [
    ...new Set([
      q,
      numbered,
      numbered.replace(/\bgray\b/g, "grey"),
      numbered.replace(/\bgrey\b/g, "gray"),
    ]),
  ]
    .filter(Boolean)
    .slice(0, 4);
}

/** 1–3 letters (no digits): only exact or prefix title matches are allowed. */
export function isShortAlpha(q: string): boolean {
  const n = normalizeGreek(q);
  return n.length > 0 && n.replace(/\s/g, "").length <= 3 && !/\d/.test(n);
}

/** External lookups only for ≥2 digits or ≥3 letters. */
export function allowsExternal(q: string): boolean {
  const n = normalizeGreek(q).replace(/\s/g, "");
  const digits = (n.match(/\d/g) ?? []).length;
  return digits >= 2 || n.length >= 3;
}

/**
 * Ordered coverage: longest contiguous run of query tokens matching title tokens in order,
 * where the last query token may be a prefix. Returns run length (0 if none).
 */
function contiguousRun(qt: string[], tt: string[]): number {
  let best = 0;
  for (let s = 0; s < tt.length; s++) {
    let k = 0;
    while (k < qt.length && s + k < tt.length) {
      const last = k === qt.length - 1;
      const ok = last ? tt[s + k].startsWith(qt[k]) : tt[s + k] === qt[k];
      if (!ok) break;
      k++;
    }
    if (k === qt.length) best = Math.max(best, k);
  }
  return best;
}

/** Fraction of query tokens found in order in the title (tokens may prefix-match). */
function orderedSimilarity(qt: string[], tt: string[]): number {
  let j = 0;
  let hit = 0;
  for (const q of qt) {
    let k = j;
    while (k < tt.length && !tt[k].startsWith(q)) k++;
    // A missed token must not consume the remaining title tokens.
    if (k < tt.length) {
      hit++;
      j = k + 1;
    }
  }
  return qt.length ? hit / qt.length : 0;
}

/** Fuzzy limits keep per-keystroke cost bounded: O(QT * TT * L^2) with small caps. */
export const FUZZY_MAX_QUERY_CHARS = 80;
export const FUZZY_MAX_QUERY_TOKENS = 8;
export const FUZZY_MAX_TARGET_TOKENS = 24;
export const FUZZY_MAX_TOKEN_CHARS = 24;

/** Allowed edits per token: none ≤4 chars, 1 for 5–7, 2 for ≥8. Digits never fuzzy. */
export function maxEdits(token: string): number {
  if (/\d/.test(token) || token.length <= 4) return 0;
  return token.length >= 8 ? 2 : 1;
}

/** Bounded Damerau (optimal string alignment) distance; returns max+1 when exceeded. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length > FUZZY_MAX_TOKEN_CHARS || b.length > FUZZY_MAX_TOKEN_CHARS) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows[i] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) {
        rows[0][j] = j;
        continue;
      }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, rows[i - 2][j - 2] + 1);
      rows[i][j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (i > 0 && rowMin > max) return max + 1;
  }
  return rows[a.length][b.length];
}

/** Query token ~ target token: exact/prefix, or within edit budget (same first letter <8 chars). */
function fuzzyTokenMatch(q: string, t: string, isLast: boolean): "exact" | "fuzzy" | null {
  if (t === q || (isLast && t.startsWith(q))) return "exact";
  const k = maxEdits(q);
  if (!k) return null;
  if (q.length < 8 && q[0] !== t[0]) return null;
  if (editDistance(q, t, k) <= k) return "fuzzy";
  // Partial last token: compare against the target's prefix of similar length.
  if (isLast && t.length > q.length && editDistance(q, t.slice(0, q.length), k) <= k)
    return "fuzzy";
  return null;
}

/**
 * Ordered fuzzy coverage: fraction of query tokens matched in order, requiring ≥1 typo
 * match (otherwise exact tiers already apply). Returns 0 when not a fuzzy match.
 */
export function fuzzySimilarity(query: string, target: string): number {
  if (query.length > FUZZY_MAX_QUERY_CHARS) return 0;
  const qt = query.split(" ").filter(Boolean).slice(0, FUZZY_MAX_QUERY_TOKENS);
  const tt = target.split(" ").filter(Boolean).slice(0, FUZZY_MAX_TARGET_TOKENS);
  if (!qt.length || !tt.length) return 0;
  let j = 0;
  let hit = 0;
  let fuzzy = 0;
  qt.forEach((q, i) => {
    for (let k = j; k < tt.length; k++) {
      const m = fuzzyTokenMatch(q, tt[k], i === qt.length - 1);
      if (m) {
        hit++;
        if (m === "fuzzy") fuzzy++;
        j = k + 1;
        return;
      }
    }
  });
  const cov = hit / qt.length;
  return fuzzy > 0 && cov >= 0.75 ? cov * 0.9 : 0;
}

/** Fuzzy applies only to non-short, non-ISBN, non-numeric queries. */
export function allowsFuzzy(q: string): boolean {
  const n = normalizeGreek(q);
  return !isShortAlpha(q) && !looksLikeIsbn(q) && !/^[\d\s]+$/.test(n) && n.length >= 5;
}

const hasGreek = (s: string) => /[α-ω]/.test(normalizeGreek(s));

function authorForms(query: string, author: string, short: boolean): string[] {
  const f = forms(author, true);
  if (!short && author && hasGreek(author) !== hasGreek(query)) f.push(greeklishSkeleton(author));
  return f;
}

export type Score = { tier: number; sim: number };
export const EXCLUDED = 99;

function titleScore(q: string, title: string, short: boolean): Score {
  const qt = q.split(" ").filter(Boolean);
  const tt = title.split(" ").filter(Boolean);
  if (!qt.length || !tt.length) return { tier: EXCLUDED, sim: 0 };
  if (title === q) return { tier: 0, sim: 1 };
  if (title.startsWith(q)) return { tier: 1, sim: q.length / title.length };
  if (short) return { tier: EXCLUDED, sim: 0 };
  const run = contiguousRun(qt, tt);
  if (run) return { tier: 1, sim: run / tt.length };
  const sim = Math.max(orderedSimilarity(qt, tt), title.includes(q) ? 0.75 : 0);
  return sim >= 0.5 ? { tier: 2, sim } : { tier: EXCLUDED, sim: 0 };
}

/** Lower tier is better; EXCLUDED means irrelevant and must not be shown. */
export function scoreBook(query: string, b: Book): Score {
  if (looksLikeIsbn(query)) {
    return normalizeIsbn(b.isbn || "") === normalizeIsbn(query)
      ? { tier: 0, sim: 1 }
      : { tier: EXCLUDED, sim: 0 };
  }
  const short = isShortAlpha(query);
  const aliases = phraseAliases(query);
  // Short queries never use the cross-script skeleton (avoids noisy short-token matches).
  const queries = [...new Set(aliases.flatMap((q) => forms(q, true)))];
  const titles = [...new Set([...forms(b.titleEl || b.title, true), ...forms(b.title, true)])];
  // Greeklish skeletons are compared only across scripts (Latin query vs Greek title or
  // vice versa) and never for short queries, so same-script spelling stays strict.
  const crossTitle = [b.titleEl, b.title].find((t) => t && hasGreek(t) !== hasGreek(query));
  if (!short && crossTitle) {
    queries.push(greeklishSkeleton(query));
    titles.push(greeklishSkeleton(crossTitle));
  }
  let best: Score = { tier: EXCLUDED, sim: 0 };
  const better = (s: Score) => s.tier < best.tier || (s.tier === best.tier && s.sim > best.sim);
  for (const q of queries)
    for (const t of titles) {
      const s = titleScore(q, t, short);
      if (better(s)) best = s;
    }
  if (best.tier < EXCLUDED || short) return best;
  const fuzzy = allowsFuzzy(query);
  // Typo-tolerant title matches rank after every exact/prefix/ordered title match.
  if (fuzzy)
    for (const q of queries)
      for (const t of titles) {
        const sim = fuzzySimilarity(q, t);
        if (sim && better({ tier: 3, sim })) best = { tier: 3, sim };
      }
  if (best.tier < EXCLUDED) return best;
  // Author matches rank after every title match (tier 4 exact, tier 5 typo-tolerant).
  for (const q of queries)
    for (const a of authorForms(query, b.author || "", short)) {
      if (!a) continue;
      const qt = q.split(" ");
      const sim = a.startsWith(q) ? 1 : a.includes(q) ? 0.8 : orderedSimilarity(qt, a.split(" "));
      if (sim >= 0.5 && better({ tier: 4, sim })) best = { tier: 4, sim };
    }
  if (best.tier < EXCLUDED || !fuzzy) return best;
  for (const q of queries)
    for (const a of authorForms(query, b.author || "", short)) {
      const sim = a ? fuzzySimilarity(q, a) : 0;
      if (sim && better({ tier: 5, sim })) best = { tier: 5, sim };
    }
  return best;
}

/** Similarity bucket: popularity may only reorder books within the same bucket. */
const bucket = (sim: number) => Math.round(sim * 10);

/**
 * Rank candidates: tier, then similarity bucket, then real popularity (if any), then
 * original provider order. Irrelevant candidates are dropped. Stable and deterministic.
 */
export function rankBooks(query: string, books: Book[], limit = 8): Book[] {
  return books
    .map((b, i) => ({ b, i, s: scoreBook(query, b) }))
    .filter((x) => x.s.tier < EXCLUDED)
    .sort(
      (x, y) =>
        x.s.tier - y.s.tier ||
        bucket(y.s.sim) - bucket(x.s.sim) ||
        (y.b.popularity ?? 0) - (x.b.popularity ?? 0) ||
        x.i - y.i,
    )
    .slice(0, limit)
    .map((x) => x.b);
}
