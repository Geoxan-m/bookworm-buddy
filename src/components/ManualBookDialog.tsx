import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { Book } from "@/lib/books";
import type { BookStatus } from "@/lib/libraryStore";
import {
  MANUAL_STATUSES,
  buildManualBook,
  onceAtATime,
  validateManual,
  type ManualErrors,
} from "@/lib/manualBook";

const STATUS_LABEL: Record<BookStatus, string> = {
  current: "reading_now",
  read: "read",
  want: "want",
  buy: "tab_buy",
};

type Props = {
  open: boolean;
  initialTitle?: string;
  onOpenChange: (o: boolean) => void;
  onAdd: (book: Book, status: BookStatus) => Promise<void> | void;
};

export function ManualBookDialog({ open, initialTitle = "", onOpenChange, onAdd }: Props) {
  const { t } = useI18n();
  const [f, setF] = useState({
    title: initialTitle,
    author: "",
    isbn: "",
    genre: "",
    coverUrl: "",
  });
  const [status, setStatus] = useState<BookStatus>("want");
  const [errors, setErrors] = useState<ManualErrors>({});
  const [busy, setBusy] = useState(false);

  const submit = useMemo(
    () =>
      onceAtATime(async (input: typeof f, st: BookStatus) => {
        setBusy(true);
        try {
          await onAdd(buildManualBook({ ...input, status: st }), st);
          setF({ title: "", author: "", isbn: "", genre: "", coverUrl: "" });
          setStatus("want");
          onOpenChange(false);
        } finally {
          setBusy(false);
        }
      }),
    [onAdd, onOpenChange],
  );

  const field = (key: keyof typeof f, label: string, required = false, type = "text") => (
    <div className="space-y-1">
      <Label htmlFor={`mb-${key}`} className="text-xs">
        {label}
        {required && " *"}
      </Label>
      <Input
        id={`mb-${key}`}
        type={type}
        value={f[key]}
        maxLength={key === "coverUrl" ? 1000 : 300}
        aria-invalid={!!errors[key as keyof ManualErrors]}
        onChange={(e) => setF((s) => ({ ...s, [key]: e.target.value }))}
        className="h-9"
      />
      {errors[key as keyof ManualErrors] && (
        <p className="text-xs text-destructive">{t(errors[key as keyof ManualErrors]!)}</p>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("manual_title")}</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const errs = validateManual(f);
            setErrors(errs);
            if (Object.keys(errs).length === 0) void submit(f, status);
          }}
        >
          {field("title", t("manual_field_title"), true)}
          {field("author", t("manual_field_author"), true)}
          <div className="grid grid-cols-2 gap-3">
            {field("isbn", "ISBN")}
            {field("genre", t("manual_field_genre"))}
          </div>
          {field("coverUrl", t("manual_field_cover"), false, "url")}
          <div className="space-y-1">
            <Label className="text-xs">{t("manual_field_list")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {MANUAL_STATUSES.map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={status === s ? "default" : "outline"}
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                >
                  {t(STATUS_LABEL[s])}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
