import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DragonRating } from "@/components/DragonRating";
import { useI18n } from "@/lib/i18n";
import type { Book } from "@/lib/books";

type Props = {
  book: Book | null;
  onClose: () => void;
  onSave: (rating: number | null, text: string) => void;
};

export function ReviewDialog({ book, onClose, onSave }: Props) {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");

  if (!book) return null;

  const submit = () => {
    if (!text.trim() && rating === 0) {
      onClose();
      return;
    }
    onSave(rating || null, text.trim());
    setRating(0);
    setText("");
  };

  return (
    <Dialog open={!!book} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{t("review_prompt")}</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-xs text-muted-foreground">"{book.titleEl || book.title}"</p>

        <div>
          <p className="mb-1 text-xs font-medium">{t("your_rating")}</p>
          <DragonRating value={rating} size={28} onChange={setRating} />
        </div>

        <Textarea
          placeholder={t("review_placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={2000}
        />

        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            {t("skip")}
          </Button>
          <Button className="flex-1" onClick={submit}>
            {t("save_review")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
