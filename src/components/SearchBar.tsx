import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import { dedupeBooks } from "@/lib/searchBooks";
import { progressiveSearch, type SearchSource } from "@/lib/searchMerge";
import { refFromBook } from "@/lib/externalMappers";
import {
  getCatalogMatches,
  getGreekBookResults,
  getInternationalBookResults,
  saveExternalBook,
} from "@/lib/greekBooks.functions";
import type { Book } from "@/lib/books";
import { BookCover } from "@/components/BookCover";
import { allowsExternal, rankBooks } from "@/lib/searchRank";

type Props = {
  onAddManual?: (query: string) => void;
  localBooks: Book[];
  onPick: (b: Book) => void;
  onSubmitQuery?: (q: string) => void;
};

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-primary/25 px-0.5 text-foreground">
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function SearchBar({ localBooks, onPick, onSubmitQuery, onAddManual }: Props) {
  const { t, lang } = useI18n();
  const fetchGreekBooks = useServerFn(getGreekBookResults);
  const fetchCatalog = useServerFn(getCatalogMatches);
  const fetchIntl = useServerFn(getInternationalBookResults);
  const saveExternal = useServerFn(saveExternalBook);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced online lookup; bounded by allowsExternal (≥2 digits or ≥3 letters)
  useEffect(() => {
    const term = q.trim();
    if (!term) setOnline([]);
    // Short alphabetic queries rank already-loaded candidates only (no external fan-out).
    if (!allowsExternal(term)) {
      setLoading(false);
      return;
    }
    const serverOk = term.length >= 3; // catalogue/Biblionet need ≥3 chars
    const controller = new AbortController();
    setLoading(true);
    const tmr = setTimeout(() => {
      // Greek source first = Greek-first ranking; each source updates as it lands.
      const sources: SearchSource[] = [
        ...(serverOk
          ? [
              {
                run: (signal: AbortSignal) =>
                  fetchCatalog({ data: { query: term, limit: 14 }, signal }).then((r) => r.books),
              },
              {
                run: (signal: AbortSignal) =>
                  fetchGreekBooks({ data: { query: term, limit: 14 }, signal }).then(
                    (r) => r.books,
                  ),
              },
            ]
          : []),
        // Google Books + Open Library via the server (≥2 digits or ≥3 letters).
        {
          run: (signal: AbortSignal) =>
            fetchIntl({ data: { query: term, limit: 14 }, signal }).then((r) => r.books),
        },
      ];
      void progressiveSearch(sources, controller.signal, (books, done) => {
        if (controller.signal.aborted) return;
        if (books.length > 0 || done) setOnline(books);
        if (done) setLoading(false);
      });
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(tmr);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const suggestions = useMemo(() => {
    const term = q.trim();
    if (!term) return [];
    // Re-ranked on every keystroke; irrelevant online results are dropped, not admitted.
    return rankBooks(term, dedupeBooks([...localBooks, ...online]), 8);
  }, [q, localBooks, online]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (q.trim().length >= 1) setOpen(true);
    setActive(0);
  }, [q]);

  const pick = (b: Book) => {
    setOpen(false);
    setQ("");
    onPick(b);
    // Only an ID is sent; the server re-fetches and validates the record itself.
    const ref = refFromBook(b);
    if (ref) void saveExternal({ data: ref }).catch(() => undefined);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(suggestions.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (suggestions[active]) {
        e.preventDefault();
        pick(suggestions[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (suggestions[active]) pick(suggestions[active]);
          else onSubmitQuery?.(q);
        }}
        className="flex items-center gap-2 rounded-full border bg-card/80 p-1.5 pl-4 shadow-sm backdrop-blur"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.trim().length >= 1 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("search_placeholder")}
          className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
          aria-autocomplete="list"
          aria-expanded={open}
        />
        <Button type="submit" size="sm" className="h-9 rounded-full px-4">
          {t("find")}
        </Button>
      </form>

      {open && q.trim().length >= 1 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[60vh] overflow-auto rounded-2xl border bg-popover/95 shadow-xl backdrop-blur animate-fade-in">
          {loading && suggestions.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> {t("searching")}
            </div>
          )}
          {!loading && suggestions.length === 0 && allowsExternal(q.trim()) && (
            <div className="px-4 py-3 text-xs text-muted-foreground">{t("no_suggestions")}</div>
          )}
          <ul role="listbox" className="py-1">
            {suggestions.map((b, i) => {
              const title = lang === "el" && b.titleEl ? b.titleEl : b.title;
              const term = q.trim();
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(b)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                      i === active ? "bg-accent" : "hover:bg-accent/60"
                    }`}
                  >
                    <BookCover book={b} className="h-12 w-9 shrink-0 rounded shadow" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        <Highlight text={title} q={term} />
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        <Highlight text={b.author} q={term} />
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {onAddManual && !loading && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAddManual(q.trim());
              }}
              className="w-full border-t px-4 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              {t("manual_add")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
