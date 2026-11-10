import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAiSuggestions, type AiSuggestion } from "@/lib/suggest.functions";
import { getInternationalBookResults } from "@/lib/greekBooks.functions";
import type { Book } from "@/lib/books";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { BookCover } from "@/components/BookCover";
import { Sparkles, BookOpen, Bookmark, ShoppingCart, RefreshCw } from "lucide-react";

type Props = {
  history: Book[];
  onRead: (b: Book) => void;
  onWant: (b: Book) => void;
  onBuy: (b: Book) => void;
  onSelect: (b: Book) => void;
};

export function AiSuggestions({ history, onRead, onWant, onBuy, onSelect }: Props) {
  const { t, lang } = useI18n();
  const fetchSuggestions = useServerFn(getAiSuggestions);
  const fetchIntl = useServerFn(getInternationalBookResults);
  const [items, setItems] = useState<Array<AiSuggestion & { book?: Book }>>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    const payload = history.slice(0, 25).map((b) => ({ title: b.title, author: b.author }));
    const r = await fetchSuggestions({ data: { history: payload, lang } });
    if (r.error) {
      setErr(
        r.error === "rate_limit"
          ? t("ai_rate_limit")
          : r.error === "payment_required"
            ? t("ai_payment")
            : t("ai_error"),
      );
      setLoading(false);
      return;
    }
    // Hydrate each suggestion with Open Library cover/data
    const hydrated = await Promise.all(
      r.suggestions.map(async (s) => {
        const found = await fetchIntl({
          data: { query: `${s.title} ${s.author}`.slice(0, 160), limit: 1 },
        })
          .then((x) => x.books)
          .catch(() => []);
        return { ...s, book: found[0] };
      }),
    );
    setItems(hydrated);
    setLoading(false);
  };

  useEffect(() => {
    if (items.length === 0) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t("ai_for_you")}
        </h3>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? t("ai_thinking") : t("refresh")}
        </Button>
      </div>
      {err && <p className="rounded-xl border bg-card/70 p-3 text-xs text-destructive">{err}</p>}
      {loading && items.length === 0 && (
        <p className="rounded-xl border bg-card/70 p-3 text-xs text-muted-foreground">
          {t("ai_thinking")}
        </p>
      )}
      <div className="space-y-2">
        {items.map((s, i) => (
          <div key={i} className="rounded-xl border bg-card/70 p-3">
            <div className="flex gap-3">
              {s.book && (
                <button onClick={() => s.book && onSelect(s.book)} className="shrink-0">
                  <BookCover book={s.book} className="h-16 w-11 rounded shadow" />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">{s.author}</p>
                <p className="mt-1 text-[11px] italic text-muted-foreground">"{s.reason}"</p>
                {s.book && (
                  <div className="mt-2 flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title={t("add_to_read")}
                      onClick={() => s.book && onRead(s.book)}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title={t("add_to_want")}
                      onClick={() => s.book && onWant(s.book)}
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title={t("add_to_buy")}
                      onClick={() => s.book && onBuy(s.book)}
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
