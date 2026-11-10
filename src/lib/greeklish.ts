/**
 * Conservative Greek ↔ Latin/Greeklish comparison helpers. Pure, deterministic,
 * no dependencies. Everything collapses into one phonetic "skeleton" so both
 * scripts compare equal without generating combinatorial spelling variants.
 */
import { normalizeGreek, stripLeadingArticle } from "./greekNormalize";

const GREEK_DIGRAPHS: Array<[RegExp, string]> = [
  [/ου/g, "u"],
  [/(ει|οι|υι)/g, "i"],
  [/αι/g, "e"],
  [/αυ/g, "av"],
  [/ευ/g, "ev"],
  [/μπ/g, "b"],
  [/ντ/g, "d"],
  [/(γκ|γγ)/g, "g"],
  [/τσ/g, "ts"],
  [/τζ/g, "tz"],
];

const GREEK_LETTERS: Record<string, string> = {
  α: "a",
  β: "v",
  γ: "g",
  δ: "d",
  ε: "e",
  ζ: "z",
  η: "i",
  θ: "8",
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
  τ: "t",
  υ: "i",
  φ: "f",
  χ: "x",
  ψ: "ps",
  ω: "o",
};

/** Latin/Greeklish spellings folded onto the same skeleton letters. Order matters. */
const LATIN_RULES: Array<[RegExp, string]> = [
  [/th/g, "8"],
  [/(ch|kh)/g, "x"],
  [/ks/g, "x"],
  [/ph/g, "f"],
  [/mp/g, "b"],
  [/nt/g, "d"],
  [/(gk|gg)/g, "g"],
  [/ou/g, "u"],
  [/(ei|oi|yi)/g, "i"],
  [/ai/g, "e"],
  [/au/g, "av"],
  [/eu/g, "ev"],
  [/y/g, "i"],
  [/w/g, "o"],
  [/c/g, "k"],
  [/(.)\1+/g, "$1"],
];

const hasGreekChars = (s: string) => /[α-ω]/.test(s);

/** Skeleton of one normalized token. Digit-only tokens are returned unchanged. */
function skeletonToken(tok: string): string {
  if (/^\d+$/.test(tok)) return tok;
  let s = tok;
  if (hasGreekChars(s)) {
    for (const [re, v] of GREEK_DIGRAPHS) s = s.replace(re, v);
    s = s.replace(/[α-ω]/g, (ch) => GREEK_LETTERS[ch] ?? ch);
  }
  for (const [re, v] of LATIN_RULES) s = s.replace(re, v);
  return s;
}

/** Script-independent skeleton: "Η γλώσσα των δράκων" == "i glossa ton drakon". */
export function greeklishSkeleton(value: string): string {
  return normalizeGreek(value).split(" ").filter(Boolean).map(skeletonToken).join(" ");
}

/** True when the normalized text is Latin letters/spaces only (no Greek, no digits). */
export function isLatinWords(value: string): boolean {
  const n = normalizeGreek(value);
  return /^[a-z ]+$/.test(n) && /[a-z]/.test(n);
}

const LATIN_TO_GREEK: Array<[RegExp, string]> = [
  [/th/g, "θ"],
  [/ch/g, "χ"],
  [/ps/g, "ψ"],
  [/ks/g, "ξ"],
  [/ou/g, "ου"],
  [/mp/g, "μπ"],
  [/nt/g, "ντ"],
  [/gk/g, "γκ"],
  [/ei/g, "ει"],
  [/ai/g, "αι"],
];
const LATIN_LETTERS: Record<string, string> = {
  a: "α",
  b: "β",
  c: "κ",
  d: "δ",
  e: "ε",
  f: "φ",
  g: "γ",
  h: "η",
  i: "ι",
  k: "κ",
  l: "λ",
  m: "μ",
  n: "ν",
  o: "ο",
  p: "π",
  r: "ρ",
  s: "σ",
  t: "τ",
  u: "υ",
  v: "β",
  w: "ω",
  x: "ξ",
  y: "υ",
  z: "ζ",
};

/**
 * One deterministic Greek spelling for a Latin query (for Greek-only sources such as
 * Biblionet). Null for short, numeric, mixed or non-Latin input.
 */
export function latinToGreekQuery(value: string): string | null {
  const n = normalizeGreek(value);
  if (!isLatinWords(n) || n.replace(/\s/g, "").length < 5) return null;
  return n
    .split(" ")
    .map((tok) => {
      let s = tok;
      for (const [re, v] of LATIN_TO_GREEK) s = s.replace(re, v);
      s = s.replace(/[a-z]/g, (ch) => LATIN_LETTERS[ch] ?? "");
      return s.replace(/σ$/, "ς");
    })
    .join(" ");
}

const SKELETON_ARTICLES = new Set(["o", "i", "to", "ta", "enas", "ena", "mia"]);
function stripSkeletonArticle(s: string): string {
  const [first, ...rest] = s.split(" ");
  return rest.length && SKELETON_ARTICLES.has(first) ? rest.join(" ") : s;
}

/** Cross-script identity key: article-less title skeleton + author skeleton. */
export function crossScriptKey(title: string, author: string): string | null {
  const a = greeklishSkeleton(author);
  const t = stripSkeletonArticle(greeklishSkeleton(stripLeadingArticle(title)));
  // Require real author evidence and a non-trivial title to avoid false merges.
  if (!a || a.replace(/\s/g, "").length < 3 || t.replace(/\s/g, "").length < 4) return null;
  return `${t}|${a}`;
}
