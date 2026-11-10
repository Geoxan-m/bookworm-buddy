import type { Book } from "@/lib/books";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "@/components/BookCover";
import { useI18n } from "@/lib/i18n";

type Props = {
  book: Book;
  onSelect?: (b: Book) => void;
  onSetCurrent?: (b: Book) => void;
};

export function BookCard({ book, onSelect, onSetCurrent }: Props) {
  const { t, lang } = useI18n();
  const title = lang === "el" && book.titleEl ? book.titleEl : book.title;
  const desc = lang === "el" && book.descriptionEl ? book.descriptionEl : book.description;
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex gap-4">
        <BookCover book={book} className="h-28 w-20 shrink-0 rounded-md shadow-md" />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{book.author}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-[10px]">
              {book.genre}
            </Badge>
            {book.series && (
              <Badge variant="outline" className="text-[10px]">
                {book.series}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{desc}</p>
      <div className="mt-3 flex gap-2">
        {onSelect && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onSelect(book)}
          >
            {t("details")}
          </Button>
        )}
        {onSetCurrent && (
          <Button size="sm" className="h-7 text-xs" onClick={() => onSetCurrent(book)}>
            {t("reading_now")}
          </Button>
        )}
      </div>
    </div>
  );
}
