import { useState } from "react";
import type { Book } from "@/lib/books";

export function BookCover({ book, className = "" }: { book: Book; className?: string }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/30 text-center text-[10px] font-medium leading-tight text-foreground/70 ${className}`}
      >
        <span className="line-clamp-3 px-1">{book.title}</span>
      </div>
    );
  }
  return (
    <img
      src={book.coverUrl}
      alt={book.title}
      loading="lazy"
      onError={() => setErr(true)}
      className={`object-cover ${className}`}
    />
  );
}
