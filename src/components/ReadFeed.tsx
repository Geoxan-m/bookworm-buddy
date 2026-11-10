import type { Book } from "@/lib/books";
import type { Note } from "@/components/CurrentBookBar";
import { BookCover } from "@/components/BookCover";
import { DragonRating } from "@/components/DragonRating";
import { useI18n } from "@/lib/i18n";
import { canonicalGenre, genreLabel, type GenreKey } from "@/lib/genres";

type Props = {
  books: Book[];
  notes: Record<string, Note[]>;
  onSelect: (b: Book) => void;
  onRate?: (b: Book) => void;
};

function ratingFor(notes: Note[] | undefined): number {
  if (!notes) return 0;
  for (let i = notes.length - 1; i >= 0; i--) {
    const r = notes[i].rating;
    if (typeof r === "number" && r > 0) return r;
  }
  return 0;
}

export function ReadFeed({ books, notes, onSelect, onRate }: Props) {
  const { t, lang } = useI18n();

  const groups = new Map<GenreKey, Book[]>();
  for (const b of books) {
    const g = canonicalGenre(b.genre);
    const arr = groups.get(g) ?? [];
    arr.push(b);
    groups.set(g, arr);
  }
  const ordered = [...groups.entries()]
    .map(([k, arr]) => [k, genreLabel(k, lang), arr] as const)
    .sort((a, b) => {
      if (a[0] === "other") return 1;
      if (b[0] === "other") return -1;
      return a[1].localeCompare(b[1]);
    });
  for (const [, , arr] of ordered) {
    arr.sort((a, b) => {
      const ta = (lang === "el" && a.titleEl) || a.title;
      const tb = (lang === "el" && b.titleEl) || b.title;
      return ta.localeCompare(tb);
    });
  }

  return (
    <div className="space-y-4">
      {ordered.map(([key, label, list]) => (
        <section key={key}>
          <h4 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </h4>
          <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border bg-card/70 backdrop-blur">
            {list.map((b) => {
              const title = lang === "el" && b.titleEl ? b.titleEl : b.title;
              const rating = ratingFor(notes[b.id]);
              return (
                <li key={b.id} className="flex items-center gap-3 px-3 py-2">
                  <button
                    onClick={() => onSelect(b)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:opacity-80"
                  >
                    <BookCover book={b} className="h-10 w-7 shrink-0 rounded-sm shadow" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{b.author}</p>
                    </div>
                  </button>
                  {rating > 0 ? (
                    <DragonRating value={rating} size={11} />
                  ) : onRate ? (
                    <button
                      onClick={() => onRate(b)}
                      className="shrink-0 rounded-full border border-primary/40 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      {t("rate_this_book")}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
