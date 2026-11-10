# Data dictionary

Plain-language guide to the main tables. "Normalized" means lowercased, accents
removed, final `ς` treated as `σ`, punctuation collapsed (see
`src/lib/greekNormalize.ts`).

## book_catalog — shared catalogue of books found by search
Anyone may **read** it. Only trusted server code (service role) can write it.

| Column | Meaning |
| --- | --- |
| id | Row id (uuid). |
| dedupe_key | Uniqueness key: `isbn:<ISBN-13>` or normalized title + author. |
| isbn_norm | ISBN-13 digits, or null. |
| title / title_norm | Title as shown / normalized without a leading Greek article. |
| author / author_norm | Author as shown / normalized; empty when unknown (placeholders like "Unknown" are never stored). |
| genre, cover_url, description | Display metadata ("" when unknown). |
| source, source_id, source_url | Where the record came from. |
| created_at, updated_at, last_validated_at | Timestamps. |
| work_key | *Optional.* Provisional identity of the literary work (title + author, ignoring ISBN), so several editions can later be grouped. |
| edition_key | *Optional.* Identity of one edition: ISBN if known, else title + author + publisher/year/language. |
| series_title / series_title_norm | *Optional.* Series name as given / normalized. |
| series_number | *Optional.* Volume number (e.g. 3 or 2.5); only set when clearly parseable. |
| publisher | *Optional.* Publisher name. |
| published_year | *Optional.* Year, must be between 1000 and 2200. |
| language_code | *Optional.* Short language code such as `el` or `en`. |

Sources: `biblionet` (from searches), `google` and `openlibrary` (saved when a
user picks that result; the server re-fetches the record by ID). Open Library's
"first published" year describes the work, not an edition, so it is not stored
in `published_year`.

Optional columns stay null when a source does not supply them; nothing is
guessed. Older rows have them all null.

## rate_limits — server-only abuse counters
`bucket` (e.g. `external:global` or `write:c:<hash>`), `window_start`, `hits`.
Updated only through the server-only `rate_limit_hit` function; browsers have
no access.

## search_cache — remembers recent searches
Server-only (no browser access). `query_norm` (normalized query),
`result_keys` (matching `dedupe_key`s), `fetched_at`. Entries older than 7 days
are refreshed on the next search.

## user_books — each user's personal library
Readable and writable only by its owner. `user_id`, `book_id`, `status`
(`reading`, `read`, `want`, `buy`; one status per book), `book_data` (a copy
of the book's details, including manually added books), `created_at`.

Related: `book_notes` (owner-only notes and optional 1–5 rating) and
`profiles` (owner-only settings, current book, dragon XP).
