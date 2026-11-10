import type { Book } from "@/lib/books";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { BookCover } from "@/components/BookCover";
import { useI18n } from "@/lib/i18n";

export type Note = { id: string; body: string; rating?: number | null };

type Props = {
  book: Book;
  notes: Note[];
  onAddNote: (c: string) => void;
  onDeleteNote: (id: string) => void;
};

export function CurrentBookBar({ book, notes, onAddNote, onDeleteNote }: Props) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const title = lang === "el" && book.titleEl ? book.titleEl : book.title;
  return (
    <div className="rounded-2xl border bg-card/70 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center gap-3">
        <BookCover book={book} className="h-16 w-11 shrink-0 rounded-md shadow" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("currently_reading")}
          </p>
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{book.author}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          <MessageSquare className="mr-1 h-3 w-3" />
          {notes.length}
        </Button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {notes.length === 0 && <p className="text-xs text-muted-foreground">{t("no_notes")}</p>}
            {notes.map((n) => (
              <div
                key={n.id}
                className="group flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs"
              >
                <p className="flex-1 whitespace-pre-wrap">{n.body}</p>
                <button
                  onClick={() => onDeleteNote(n.id)}
                  title={t("delete")}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("note_placeholder")}
              className="min-h-[60px] flex-1 text-xs"
            />
            <Button
              size="sm"
              onClick={() => {
                if (draft.trim()) {
                  onAddNote(draft.trim());
                  setDraft("");
                }
              }}
            >
              {t("save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
