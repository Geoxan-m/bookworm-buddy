# Bookworm Buddy

<img src="src/assets/bookhoarder-logo.png" width="160" alt="Black dragon reading books">

A bilingual Greek/English reading tracker for organizing a personal library, discovering books and keeping notes on what you read.

Built by Georgios Xanthakis with AI assistance through Lovable.

## What you can do

- Organize books into Reading now, Read, Up next and Shopping list.
- Search titles and authors using Open Library, Google Books and a Biblionet-based Greek catalogue lookup.
- Add a book manually when a provider does not have it.
- Keep notes and 1–5 ratings, including when moving books between lists.
- Explore AI-generated reading suggestions.
- Use retailer and second-hand shop search links.
- Track reading progress with a growing dragon companion.
- Use the interface in Greek or English and install it as a PWA.

Retail links are search shortcuts: the app does not show verified live prices or stock.

## Technology

React 19, TypeScript, TanStack Start/Router, Vite, Tailwind CSS v4, shadcn/ui, Supabase PostgreSQL/Auth, Drizzle and Vitest.

## Data and architecture

Guest libraries are stored in browser localStorage. Signed-in users can sync their library, notes, current book and dragon XP through the database. Row-level security scopes personal rows to their owner.

Search provider calls run on the server. Search includes Greek/Greeklish normalization, ranking and deduplication. A cache is reused only when its nonempty result keys resolve to catalogue records; provider failures are distinguished from valid zero results. External catalogue writes re-fetch provider metadata on the server.

See [Search pipeline](SEARCH_PIPELINE.md) and [Data dictionary](DATA_DICTIONARY.md).

## Local development

Use a recent Node.js version compatible with the installed Vite/TanStack packages.

```sh
npm ci
npm run dev
```

Provide browser configuration in an untracked .env file:

```dotenv
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

The signed-in experience also needs the database migrations and the authentication provider configured. Server-only settings include SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and LOVABLE_API_KEY. LOVABLE_DB_MIGRATION_URL is used by migration tooling. Configure these only in the hosting environment; never expose them with a VITE_ prefix or commit them to Git.

AI suggestions depend on the Lovable AI gateway and its server-side configuration; a code export alone does not provision these services.

## Checks

```sh
npm test
npm run build
npm run lint
```

These are the available project commands, not a claim that every check was run for this export.

## Project structure

- src/components/ — library UI, book details and reusable components.
- src/lib/ — persistence, search, normalization, ranking and server functions.
- src/lib/__tests__/ — regression tests.
- src/routes/ — application routes.
- supabase/migrations/ and drizzle/ — database definitions and migrations.

## Limitations

Book metadata and Greek catalogue coverage depend on external providers. Guest data remains on one device until account sync. AI recommendations may be inaccurate. The application does not perform live price comparison.

## Development approach

This is an AI-assisted portfolio project, directed and iterated by Georgios Xanthakis. It demonstrates product design, reading workflows, data organization, troubleshooting and iterative development; it is not presented as entirely hand-written software.

