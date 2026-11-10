import type { Book } from "@/lib/books";
import { USED_SHOPS } from "@/lib/books";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { BookStatus } from "@/lib/libraryStore";
import {
  ExternalLink,
  BookOpen,
  Bookmark,
  ShoppingCart,
  Recycle,
  Pencil,
  Trash2,
} from "lucide-react";
import { BookCover } from "@/components/BookCover";
import { DragonRating } from "@/components/DragonRating";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ACTION_BUTTON_CLASS, ACTION_GRID_CLASS, ACTION_ICON_CLASS } from "@/lib/bookActionLayout";

type Props = {
  book: Book | null;
  onClose: () => void;
  onMarkRead: (b: Book) => void;
  onWantRead: (b: Book) => void;
  onSetCurrent: (b: Book) => void;
  onAddToBuy?: (b: Book) => void;
  onRemove?: (b: Book) => void;
  status?: BookStatus | null;
  isRead?: boolean;
  review?: { text: string; rating: number } | null;
  onEditReview?: (b: Book) => void;
};

export function BookDetail({
  book,
  onClose,
  onMarkRead,
  onWantRead,
  onSetCurrent,
  onAddToBuy,
  onRemove,
  status,
  isRead,
  review,
  onEditReview,
}: Props) {
  const { t, lang } = useI18n();

  if (!book) return null;
  const labelKey = { current: "reading_now", want: "want", read: "read", buy: "tab_buy" } as const;
  const actions: { key: BookStatus; icon: typeof BookOpen; run: (b: Book) => void }[] = [
    { key: "current", icon: BookOpen, run: onSetCurrent },
    { key: "read", icon: BookOpen, run: onMarkRead },
    { key: "want", icon: Bookmark, run: onWantRead },
    ...(onAddToBuy ? [{ key: "buy" as const, icon: ShoppingCart, run: onAddToBuy }] : []),
  ];
  const title = lang === "el" && book.titleEl ? book.titleEl : book.title;
  const desc = lang === "el" && book.descriptionEl ? book.descriptionEl : book.description;
  const query = encodeURIComponent(`${book.title} ${book.author}`.trim());
  const shopRows = [
    { shop: "Public", url: `https://www.public.gr/search?keyword=${query}` },
    {
      shop: "Politeia",
      url: `https://www.politeianet.gr/index.php?option=com_virtuemart&page=shop.browse&keyword=${query}`,
    },
    {
      shop: "Protoporia",
      url: `https://www.protoporia.gr/index.php?route=product/search&search=${query}`,
    },
    { shop: "Skroutz", url: `https://www.skroutz.gr/search?keyphrase=${query}` },
    { shop: "Metabook", url: `https://metabook.gr/search?query=${query}` },
  ];

  return (
    <Dialog open={!!book} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6 text-base">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4">
          <BookCover book={book} className="h-48 w-32 shrink-0 rounded-md shadow-lg" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{book.author}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-[10px]">
                {book.genre}
              </Badge>
              {book.series && (
                <Badge variant="outline" className="text-[10px]">
                  {book.series}
                </Badge>
              )}
            </div>
            {desc && <p className="mt-2 text-sm leading-relaxed">{desc}</p>}
          </div>
        </div>

        {status && (
          <p className="pt-1 text-xs text-muted-foreground">
            {t("in_list")}:{" "}
            <span className="font-medium text-foreground">{t(labelKey[status])}</span>
          </p>
        )}
        <div className={cn(ACTION_GRID_CLASS, "pt-2")}>
          {actions.map(({ key, icon: Icon, run }) => (
            <Button
              key={key}
              size="sm"
              variant={status === key ? "default" : "outline"}
              aria-pressed={status === key}
              data-state={status === key ? "active" : undefined}
              className={ACTION_BUTTON_CLASS}
              onClick={() => run(book)}
            >
              <Icon className={ACTION_ICON_CLASS} /> {t(labelKey[key])}
            </Button>
          ))}
        </div>
        {status && onRemove && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 text-muted-foreground">
                <Trash2 className="mr-1 h-3.5 w-3.5" /> {t("remove_book")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("confirm_remove_title")}</AlertDialogTitle>
                <AlertDialogDescription>{t("confirm_remove_desc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => onRemove(book)}>
                  {t("remove_book")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {isRead ? (
          <div className="mt-2">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
              <span>{t("your_rating")}</span>
              {onEditReview && (
                <button
                  onClick={() => onEditReview(book)}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/10"
                >
                  <Pencil className="h-3 w-3" /> {t("edit_review")}
                </button>
              )}
            </div>
            <button
              onClick={() => onEditReview?.(book)}
              className="w-full rounded-xl border bg-card/60 px-3 py-2 text-left transition-colors hover:bg-accent/40"
            >
              <DragonRating value={review?.rating ?? 0} size={20} />
              {review?.text ? (
                <p className="mt-2 whitespace-pre-wrap text-sm">{review.text}</p>
              ) : (
                <p className="mt-2 text-xs italic text-muted-foreground">{t("rate_this_book")}</p>
              )}
            </button>
          </div>
        ) : (
          <>
            <div className="mt-2">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <ShoppingCart className="h-3 w-3" /> {t("available_shops")}
              </div>
              <div className="space-y-1.5">
                {shopRows.map((p) => {
                  return (
                    <a
                      key={p.shop}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent/40"
                    >
                      <span>{p.shop}</span>
                      <span className="flex items-center gap-2 font-medium">
                        <span className="text-xs text-muted-foreground">{t("check_shop")}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>

            <div className="mt-2">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Recycle className="h-3 w-3" /> {t("used_for")}
              </div>
              <div className="space-y-1.5">
                {USED_SHOPS.map((o) => (
                  <a
                    key={o.shop}
                    href={o.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent/40"
                  >
                    <span>{o.shop}</span>
                    <span className="flex items-center gap-2 font-medium">
                      <span className="text-xs text-muted-foreground">{t("check_shop")}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
