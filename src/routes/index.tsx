import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import logo from "@/assets/bookhoarder-logo.png";
import type { Book } from "@/lib/books";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BookCard } from "@/components/BookCard";
import { SearchBar } from "@/components/SearchBar";
import { ManualBookDialog } from "@/components/ManualBookDialog";
import { findDuplicate } from "@/lib/manualBook";
import { BookDetail } from "@/components/BookDetail";
import { ReviewDialog } from "@/components/ReviewDialog";
import { type Note } from "@/components/CurrentBookBar";
import { BookCover } from "@/components/BookCover";
import { ReadFeed } from "@/components/ReadFeed";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AuthBar } from "@/components/AuthBar";
import { AiSuggestions } from "@/components/AiSuggestions";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import {
  emptyLibrary,
  loadLibrary,
  saveLibrary,
  mergeLibraries,
  moveBook,
  addNote as addNoteTo,
  removeNote as removeNoteFrom,
  statusOf,
  type BookStatus,
  type LibraryState,
} from "@/lib/libraryStore";
import {
  loadCloudLibrary,
  upsertBook,
  removeBookEverywhere,
  addCloudNote,
  deleteCloudNote,
  setCurrentBookCloud,
  setDragonXp,
} from "@/lib/cloudSync";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bookworm Buddy — track your reading" },
      {
        name: "description",
        content:
          "Keep your read books, up-next list and shopping list in one place, and grow your reading dragon.",
      },
      { property: "og:title", content: "Bookworm Buddy — track your reading" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content:
          "Keep your read books, up-next list and shopping list in one place, and grow your reading dragon.",
      },
    ],
  }),
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <Index />
      </AuthProvider>
    </I18nProvider>
  ),
});

function Index() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [lib, setLib] = useState<LibraryState>(emptyLibrary);
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState<Book | null>(null);
  const [reviewBook, setReviewBook] = useState<Book | null>(null);
  const [dragonHappy, setDragonHappy] = useState(false);
  const [tab, setTab] = useState("library");
  const syncedFor = useRef<string | null>(null);

  // Restore first; never write before the saved state has been read back.
  useEffect(() => {
    setLib(loadLibrary());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) saveLibrary(lib);
  }, [lib, hydrated]);

  // Merge the signed-in cloud library once per user session.
  useEffect(() => {
    if (!user || !hydrated || syncedFor.current === user.id) return;
    syncedFor.current = user.id;
    let cancelled = false;
    (async () => {
      const { data: cloud, error } = await loadCloudLibrary(user.id);
      if (cancelled) return;
      if (error || !cloud) {
        toast.error(t("sync_error"));
        return;
      }
      const merged = mergeLibraries(
        { ...lib, dragonXp: Math.max(lib.dragonXp, cloud.dragonXp) },
        cloud,
      );
      setLib(merged);
      const push: Promise<{ error?: string }>[] = [];
      for (const status of ["read", "want", "buy"] as const) {
        for (const b of merged[status]) {
          if (!cloud[status].some((x) => x.id === b.id)) push.push(upsertBook(user.id, status, b));
        }
      }
      if (merged.current && merged.current.id !== cloud.current?.id) {
        push.push(setCurrentBookCloud(user.id, merged.current));
      }
      for (const [bid, list] of Object.entries(merged.notes)) {
        const cloudIds = new Set((cloud.notes[bid] ?? []).map((n) => n.id));
        for (const n of list) if (!cloudIds.has(n.id)) push.push(addCloudNote(user.id, bid, n));
      }
      const results = await Promise.all(push);
      if (!cancelled && results.some((r) => r.error)) toast.error(t("sync_error"));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, hydrated]);

  const allBooks = useMemo(() => [...lib.read, ...lib.want, ...lib.buy], [lib]);

  const syncMove = async (book: Book, status: BookStatus | null) => {
    if (!user) return;
    const res =
      status === "current"
        ? await setCurrentBookCloud(user.id, book)
        : status
          ? await upsertBook(user.id, status, book)
          : await removeBookEverywhere(user.id, book.id);
    // When leaving "reading now", clear it on the profile too.
    if (status !== "current" && lib.current?.id === book.id)
      await setCurrentBookCloud(user.id, null);
    if (res.error) toast.error(t("sync_error"));
  };

  const move = (book: Book, status: BookStatus | null, message?: string) => {
    setLib((s) => moveBook(s, book, status));
    void syncMove(book, status);
    if (message) toast.success(message, { description: book.title });
  };

  const addToRead = (b: Book) => {
    const already = lib.read.some((x) => x.id === b.id);
    move(b, "read", t("toast_added_read"));
    setSelected(null);
    if (!already) setReviewBook(b);
  };
  const [manualOpen, setManualOpen] = useState<string | null>(null);
  const addManual = (b: Book, status: BookStatus) => {
    const lib_all = [...lib.read, ...lib.want, ...lib.buy, ...(lib.current ? [lib.current] : [])];
    const dup = findDuplicate(b, lib_all);
    if (dup) {
      toast.error(t("manual_duplicate"), { description: dup.title });
      return;
    }
    move(b, status, t("manual_added"));
    if (status === "read") setReviewBook(b);
  };
  const addToWant = (b: Book) => move(b, "want", t("toast_added_want"));
  const addToBuy = (b: Book) => move(b, "buy", t("toast_added_buy"));
  const setReading = (b: Book) => {
    move(b, "current", t("toast_set_current"));
    setSelected(null);
  };
  const removeBook = (b: Book) => {
    move(b, null, t("toast_removed"));
    setSelected(null);
  };

  const addNote = (bookId: string, text: string, rating?: number | null) => {
    const note: Note = { id: crypto.randomUUID(), body: text, rating: rating ?? null };
    setLib((s) => addNoteTo(s, bookId, note));
    if (user)
      void addCloudNote(user.id, bookId, note).then((r) => r.error && toast.error(t("sync_error")));
  };
  const deleteNote = (bookId: string, id: string) => {
    setLib((s) => removeNoteFrom(s, bookId, id));
    if (user)
      void deleteCloudNote(user.id, id).then((r) => r.error && toast.error(t("sync_error")));
  };

  const fireCelebration = () => {
    let dragonShape: confetti.Shape | undefined;
    try {
      const cf = confetti as unknown as {
        shapeFromText?: (o: { text: string; scalar?: number }) => confetti.Shape;
      };
      dragonShape = cf.shapeFromText?.({ text: "🐉", scalar: 2 });
    } catch {
      /* fallback below */
    }

    const end = Date.now() + 1400;
    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 70,
        startVelocity: 45,
        origin: { x: 0 },
        colors: ["#f5c518", "#e0b34a", "#8a2a2a", "#f4d67c"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 70,
        startVelocity: 45,
        origin: { x: 1 },
        colors: ["#f5c518", "#e0b34a", "#8a2a2a", "#f4d67c"],
      });
      if (dragonShape) {
        confetti({
          particleCount: 2,
          spread: 100,
          scalar: 1.6,
          gravity: 0.7,
          origin: { x: Math.random(), y: 0.3 },
          shapes: [dragonShape],
        });
      }
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
    setDragonHappy(true);
    setTimeout(() => setDragonHappy(false), 3500);
  };

  const handleSaveReview = (rating: number | null, text: string) => {
    if (!reviewBook) return;
    if (text) addNote(reviewBook.id, text, rating);
    const nextXp = lib.dragonXp + 1;
    setLib((s) => ({ ...s, dragonXp: nextXp }));
    if (user) void setDragonXp(user.id, nextXp);
    fireCelebration();
    toast.success(t("congrats_book"));
    setReviewBook(null);
  };

  const dragonScale = Math.min(1 + lib.dragonXp * 0.05, 1.8);

  const goHome = () => {
    setTab("library");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <main className="mx-auto min-h-screen w-full max-w-3xl px-3 pb-10">
        <header className="sticky top-0 z-30 -mx-3 mb-4 border-b border-border/50 bg-background/85 px-3 pb-3 pt-3 backdrop-blur-xl">
          <div className="mb-2 flex items-center gap-2">
            <button
              onClick={goHome}
              aria-label="Home"
              className="shrink-0 rounded-full p-0.5 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <img
                src={logo}
                alt="Bookworm Buddy"
                className={`origin-bottom transition-transform duration-500 ${dragonHappy ? "animate-bounce" : ""}`}
                style={{
                  width: 32 * dragonScale,
                  height: 32 * dragonScale,
                  transform: `scale(${dragonScale})`,
                }}
              />
            </button>
            <h1 className="flex-1 text-base font-semibold tracking-tight">Bookworm Buddy</h1>
            <LanguageSwitcher />
            <AuthBar />
          </div>
          <SearchBar
            localBooks={allBooks}
            onPick={setSelected}
            onAddManual={(q) => setManualOpen(q)}
          />
          {manualOpen !== null && (
            <ManualBookDialog
              open
              initialTitle={manualOpen}
              onOpenChange={(o) => !o && setManualOpen(null)}
              onAdd={addManual}
            />
          )}
        </header>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="sticky top-[104px] z-20 grid w-full grid-cols-4 rounded-full bg-card/80 shadow-md backdrop-blur">
            <TabsTrigger
              value="library"
              className="rounded-full text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {t("my_library")}
            </TabsTrigger>
            <TabsTrigger
              value="want"
              className="rounded-full text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {t("tab_want")}
            </TabsTrigger>
            <TabsTrigger
              value="buy"
              className="rounded-full text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {t("tab_buy")}
            </TabsTrigger>
            <TabsTrigger
              value="suggest"
              className="rounded-full text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {t("tab_suggest")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="mt-3 space-y-5">
            <CurrentReadingHero
              book={lib.current}
              notes={lib.current ? (lib.notes[lib.current.id] ?? []) : []}
              onAddNote={(text) => lib.current && addNote(lib.current.id, text)}
              onDeleteNote={(noteId) => lib.current && deleteNote(lib.current.id, noteId)}
              onSelect={setSelected}
            />
            {lib.read.length > 0 ? (
              <div>
                <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("read_list_title")}
                </h3>
                <ReadFeed
                  books={lib.read}
                  notes={lib.notes}
                  onSelect={setSelected}
                  onRate={setReviewBook}
                />
              </div>
            ) : (
              <PriorityFallback want={lib.want} buy={lib.buy} onSelect={setSelected} />
            )}
          </TabsContent>
          <TabsContent value="want" className="mt-3">
            <Grid books={lib.want} onSelect={setSelected} onSetCurrent={setReading} />
          </TabsContent>
          <TabsContent value="buy" className="mt-3">
            <Grid books={lib.buy} onSelect={setSelected} onSetCurrent={setReading} />
          </TabsContent>
          <TabsContent value="suggest" className="mt-3">
            <AiSuggestions
              history={allBooks}
              onRead={addToRead}
              onWant={addToWant}
              onBuy={addToBuy}
              onSelect={setSelected}
            />
          </TabsContent>
        </Tabs>

        <BookDetail
          book={selected}
          onClose={() => setSelected(null)}
          onMarkRead={addToRead}
          onWantRead={addToWant}
          onSetCurrent={setReading}
          onAddToBuy={addToBuy}
          onRemove={removeBook}
          status={selected ? statusOf(lib, selected.id) : null}
          isRead={!!selected && lib.read.some((b) => b.id === selected.id)}
          review={(() => {
            if (!selected) return null;
            const list = lib.notes[selected.id] ?? [];
            let rating = 0;
            let text = "";
            for (let i = list.length - 1; i >= 0; i--) {
              if (!rating && typeof list[i].rating === "number" && (list[i].rating ?? 0) > 0)
                rating = list[i].rating as number;
              if (!text && list[i].body) text = list[i].body;
              if (rating && text) break;
            }
            return { rating, text };
          })()}
          onEditReview={(b) => {
            setSelected(null);
            setReviewBook(b);
          }}
        />

        <ReviewDialog
          book={reviewBook}
          onClose={() => setReviewBook(null)}
          onSave={handleSaveReview}
        />

        <footer className="mt-8 text-center text-[10px] text-muted-foreground">
          {t("footer")}
        </footer>
      </main>
      <Toaster position="top-center" richColors />
    </>
  );
}

function PriorityFallback({
  want,
  buy,
  onSelect,
}: {
  want: Book[];
  buy: Book[];
  onSelect: (b: Book) => void;
}) {
  const { t } = useI18n();
  const sections: Array<{ label: string; books: Book[] }> = [
    { label: t("priority_want"), books: want },
    { label: t("priority_buy"), books: buy },
  ].filter((s) => s.books.length > 0);
  return (
    <div className="space-y-4">
      <p className="rounded-2xl border border-dashed bg-card/40 p-4 text-center text-xs text-muted-foreground">
        {t("empty_library")}
      </p>
      {sections.map((s) => (
        <div key={s.label}>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{s.label}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {s.books.map((b) => (
              <BookCard key={b.id} book={b} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Grid({
  books,
  onSelect,
  onSetCurrent,
}: {
  books: Book[];
  onSelect: (b: Book) => void;
  onSetCurrent: (b: Book) => void;
}) {
  const { t } = useI18n();
  if (books.length === 0)
    return (
      <div className="rounded-2xl border border-dashed bg-card/40 p-8 text-center text-xs text-muted-foreground">
        {t("empty_grid")}
      </div>
    );
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {books.map((b) => (
        <BookCard key={b.id} book={b} onSelect={onSelect} onSetCurrent={onSetCurrent} />
      ))}
    </div>
  );
}

function CurrentReadingHero({
  book,
  notes,
  onAddNote,
  onDeleteNote,
  onSelect,
}: {
  book: Book | null;
  notes: Note[];
  onAddNote: (text: string) => void;
  onDeleteNote: (noteId: string) => void;
  onSelect: (b: Book) => void;
}) {
  const { t, lang } = useI18n();
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState(false);

  if (!book) {
    return (
      <div className="rounded-3xl border border-dashed bg-card/40 p-8 text-center text-sm text-muted-foreground">
        {t("no_current_book")}
      </div>
    );
  }

  const title = lang === "el" && book.titleEl ? book.titleEl : book.title;
  const latest = notes[notes.length - 1];

  return (
    <section className="relative overflow-hidden rounded-3xl border bg-card/70 p-4 shadow-lg backdrop-blur">
      <div className="flex gap-4">
        <button onClick={() => onSelect(book)} className="shrink-0">
          <BookCover book={book} className="h-44 w-28 rounded-lg shadow-xl ring-1 ring-black/10" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("currently_reading")}
          </p>
          <h2 className="mt-0.5 text-lg font-bold leading-tight">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{book.author}</p>
          {latest && (
            <div className="group mt-3 rounded-xl bg-muted/60 px-3 py-2 text-xs">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("your_comment")}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap">{latest.body}</p>
              <button
                onClick={() => onDeleteNote(latest.id)}
                className="mt-1 text-[10px] text-muted-foreground hover:text-destructive"
              >
                {t("delete")}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        {!composing ? (
          <button
            onClick={() => setComposing(true)}
            className="w-full rounded-xl border border-dashed bg-background/40 px-3 py-2 text-left text-xs italic text-muted-foreground hover:bg-background/70"
          >
            {latest ? "+ " + t("note_placeholder") : t("write_impressions")}
          </button>
        ) : (
          <div className="flex gap-2">
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("note_placeholder")}
              className="min-h-[60px] flex-1 text-xs"
            />
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  if (draft.trim()) {
                    onAddNote(draft.trim());
                    setDraft("");
                    setComposing(false);
                  }
                }}
              >
                {t("save")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setDraft("");
                  setComposing(false);
                }}
              >
                ×
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
