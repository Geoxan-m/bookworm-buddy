# Search pipeline

How a search in Bookworm Buddy finds books, in plain language.

## 1. Waiting for you to type
Suggestions re-rank from the first character; external searches start at ≥3 letters
or ≥2 digits after a 250 ms pause. Typing again cancels
the previous search, so old answers never replace new ones.

## 2. Saved catalogue first
The app first asks its own shared catalogue (`book_catalog`) for matching
titles, authors or ISBNs. This is quick and read-only.

## 3. External sources, in parallel
At the same time it asks:
- **Biblionet** (Greek books), through the app's server. Recent searches
  (under 7 days old) are answered from `search_cache` and the catalogue
  without calling Biblionet again.
- **Google Books** and **Open Library**, through server functions only.

Each request has a time limit of about 4–4.5 seconds. Results appear as each
source answers, in a fixed priority order (catalogue, Greek, international),
and duplicates are removed by ISBN, or by title + author.

## 4. Checking the data
Only facts a source actually states are kept:
- publisher and language code (like `el`, `eng`);
- edition year only from a well-formed date: `YYYY`, `YYYY-MM` or `YYYY-MM-DD`
  with a real month/day, between 1000 and next year. "circa 1990", "2023-13",
  "2023-02-30" are rejected. Open Library's "first published" year describes
  the work, so it is never stored as an edition year;
- authors: placeholders such as "Unknown", "Anonymous", "-", "N/A",
  "Άγνωστος" are treated as missing (stored empty) and never replace a real
  author;
- series and volume only from clearly labelled Biblionet fields;
- cover images only from `https://` links;
- text fields are length-limited.
Anything missing or doubtful is left empty rather than guessed.

## 5. Who can write to the catalogue
Browsers can only **read** the catalogue. Writes happen only in server code
with the service key:
- Biblionet results are saved by the server when it searches.
- When you pick a Google Books or Open Library result, the browser sends only
  the source name and ID (for example `google` + `abcDEF123`). The server
  checks the ID format, fetches the record itself from `googleapis.com` or
  `openlibrary.org` only (no redirects, 4 s limit, 300 KB limit), confirms the
  returned ID matches, validates it, and saves it. Book details sent from the
  browser are never trusted.
- Saving never replaces existing details with blank ones.

`search_cache` is server-only. Personal lists (`user_books`) are separate and
only visible to their owner.

## 6. Abuse limits
The server counts requests in one-minute windows (table `rate_limits`, reached
only by server code):
- external Biblionet fetches: 300 per minute overall, 30 per client;
- catalogue saves of picked results: 120 per minute overall, 15 per client.

"Client" is a short hash of the connecting address set by the hosting edge, so
request data cannot change it and raw addresses are not stored. When a limit is
hit, or the counter itself fails, the search still answers from the saved
catalogue and the save is skipped; nothing errors in the app. Each search
makes a bounded number of outbound requests (a few Biblionet query variants),
and results are capped at 20 returned / 30 saved.

Limitations: counters are simple fixed windows; many users behind one shared
network share a client limit; catalogue reads are not rate-limited; international provider
calls use separate buckets (300/min globally, 30/min per hashed client).

## 7. Ranking suggestions
Suggestions are re-ranked on every keystroke from all candidates already loaded
(your library + the latest search results). Tiers, best first:
0. exact title (or exact ISBN for ISBN queries);
1. title prefix or contiguous query phrase (last token may be partial);
2. weaker title similarity (≥50% of query words found in order);
3. typo-tolerant title matches (see below);
4. author matches, then 5. typo-tolerant author matches — always after every title match.
Anything else is dropped, including irrelevant provider results.

**Popularity** (real provider counts only, e.g. Google ratings / Open Library
edition counts, log scale) is transient, never stored, and only reorders books
in the same tier and the same similarity bucket (rounded to 0.1).

**Short queries:** 1–3 letters only allow exact or prefix title matches
(so "It" keeps *It* without fuzzy noise) and rank existing candidates; 3-letter input may start
a bounded external lookup. External lookups start at ≥2 digits or ≥3 letters; server
sources (catalogue, Biblionet) need ≥3 characters. Numbers 0–100 also match
their English words inside phrases ("50 shades" → "fifty shades"); gray/grey are
bounded phrase aliases, and prefixes like "fift" match naturally.

**Limits:** 250 ms debounce; each keystroke aborts the previous search and
aborted searches never update suggestions. Google Books + Open Library use at
most 6 requests per search (general query, Greek transliteration if any, plus
one title-focused query each), ~4 s timeout, merged/deduped pool of ≤30; catalogue
and Biblionet return ≤14 each; 8 suggestions shown.

## 8. Typo tolerance
Only for queries of 5+ characters that are not short, numeric or ISBN (ISBNs
stay exact after normalization). Each query word may differ from a title/author
word by a bounded edit (insertion, deletion, substitution or swap of two
letters): no edits for words of ≤4 letters or containing digits, 1 edit for
5–7 letters (first letter must match), 2 edits for 8+. At least 75% of query
words must match in order, with at least one typo match, so "There is no
antimetics division" finds *There Is No Antimemetics Division*. Fuzzy matches
always rank below exact, prefix and ordered-word title matches.
Limits: queries over 80 characters, more than 8 query words, 24 title words or
24-letter words are not fuzzily compared. Limitations: no phonetic matching,
no Greek↔Latin typo mixing beyond transliteration, and fuzzy only re-ranks
results the sources already returned (provider queries are not rewritten).

## 9. Greeklish and cross-script matching
`src/lib/greeklish.ts` folds Greek and Latin/Greeklish text onto one
deterministic "skeleton" (after the usual case/accent/final-sigma
normalization): th/8→θ, ch/kh/x/ks→one letter, ps, mp/b, nt/d, gk/gg/g, ou/u,
ei/oi/y/η/ι→i, ai/e, w/ο/ω→o, doubled letters collapsed. So
"i glossa ton drakon" ranks *Η γλώσσα των δράκων* first, and the Greek query
still works. No spelling combinations are generated.

**Bounds:** at most 3 comparison forms per string (normalized, plain Latin
transliteration, skeleton). Skeletons are compared only across scripts
(Latin query vs Greek title/author, or the reverse) and never for 1–3 letter
queries, so same-script ranking, typo rules and "It" stay unchanged. ISBN and
numeric queries are never transliterated. Biblionet receives at most one extra
Greek spelling of a Latin query (≥5 letters), still within its 4-query cap.

**Deduplication** (catalogue, Biblionet, Google Books, Open Library): exact
normalized ISBN first; otherwise identical normalized title+author, or matching
cross-script title+author skeletons (author ≥3 letters and title ≥4 letters
required). Books with two different ISBNs are never merged by title/author, and
missing or different authors are kept apart. On merge the first (higher-priority)
entry is kept and only its blank fields are filled: HTTPS covers, valid ISBN,
positive year, longer description, genre/publisher/source fields; popularity
keeps the higher real value and stays transient.

Limitations: author-name order ("Williamson, S. F.") is not reconciled; ξ and χ
share a skeleton letter; Greeklish "h" for η is not recognised; the Greek
spelling sent to Biblionet uses plain ο/ι, so accent-sensitive misses remain;
the user's own library is not merged into search suggestions.

## Server-side international search (Google Books + Open Library)

- The browser never calls googleapis.com or openlibrary.org for search. `SearchBar` calls
  `getInternationalBookResults` (≥2 digits or ≥3 letters, same 250 ms debounce, abort/stale guard,
  progressive merge after the catalogue and Biblionet sources).
- Flow: read `book_catalog` matches + `search_cache` entry `intl:<normalized query>` (namespaced, cannot
  collide with un-prefixed Biblionet keys). Fresh (7-day TTL), nonempty keys resolving to relevant catalogue books → reconstruct
  those books in key order, rank, zero provider calls. Empty or unresolvable keys retry.
  Miss/stale → rate-limit check (`intl:global` 300/min, `intl:c:<hashed client>` 30/min) → ≤6 provider
  requests (general + title-focused, plus one Greek→Latin transliteration; none for numeric/ISBN
  queries), allow-listed origins, no redirects, 4 s timeout, 300 KB limit → validate, dedupe, pool ≤30,
  safe upsert ≤30 rows → update cache → return ≤ requested limit.
- Provider failure or rate-limit denial returns local catalogue matches. Raw IPs are never stored and the
  service key stays in server-only handlers.
- `saveExternalBook` skips the re-fetch when the same source record was validated within the TTL.

## Production correction: payloads and cache correctness
Read-only inspection on 2026-11-10 confirmed 0 catalogue rows and 52 empty cache
entries. The old fetch helper collapsed transport/HTTP/timeout/oversize/JSON errors
into null, and all-null searches were cached as successful empty answers. Oversized
full responses are a plausible cause, not proven historical telemetry.

Google requests now project totalItems and ID/title/author/publisher/category/ISBN/
cover/date/language/ratings fields; Open Library projects key/title/author/ISBN/cover/
first work year/edition count. Each request returns at most 10 records (still ≤6 in
parallel, ≤30 merged, 4 seconds, 300,000 actual bytes, allowlisted origins, no redirects).
The reader cancels oversized streams before buffering more; timeout and all failure
categories stay distinct internally, including invalid provider schema. At least one
valid response (including true zero) is required for a successful cache write; all
failures return ranked local fallback and the next search retries. Valid zero may be
stored but never suppresses future provider calls. Failed catalogue upserts cannot
produce a fresh cache record. Nonempty keys must all resolve, and yield relevant
books, before a cache hit can skip providers.

Both catalogue read paths use normalized letter/number-only OR predicates: bounded
interleaved alias tokens (≤8, title/author predicates ≤16), or exact normalized ISBN;
≤60 candidates are retrieved then rankBooks runs before slicing (≤20 server results).
This avoids whole-query-only matching and raw-input filter injection. Common tokens
may saturate the cap; there is no full-text index or schema change.

Phrase aliases preserve numeric/ISBN safety: ISBN remains exact; only isolated 0–100
number tokens gain words, with gray/grey variants, ≤4 phrases. Exact title/ISBN wins,
then prefix/contiguous phrase, ≥50% ordered query-token coverage, fuzzy title, author;
popularity remains transient and only a same-tier/similarity-bucket tiebreaker.

Privacy, RLS, source-ID-only save validation, Greek/Greeklish, Biblionet, rate limits,
manual entry and browser cancellation are unchanged. Tests use mocked providers and
in-memory cache dependencies, not production writes. No deployment occurred; publishing
the reviewed app update remains a separate action. Existing empty entries retry without
purging. Partial provider success can still cache incomplete results for seven days;
provider availability and metadata coverage are not guaranteed.
