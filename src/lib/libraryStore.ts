import type { Book } from "@/lib/books";
import type { Note } from "@/components/CurrentBookBar";

export type LibraryStatus = "read" | "want" | "buy";
export type BookStatus = LibraryStatus | "current";

export type LibraryState = {
  read: Book[];
  want: Book[];
  buy: Book[];
  current: Book | null;
  notes: Record<string, Note[]>;
  dragonXp: number;
};

export const STORAGE_KEY = "be_library_v1";
/** Legacy keys kept for backward compatibility with existing installs. */
const LEGACY_NOTES_KEY = "be_notes";
const LEGACY_BUY_KEY = "be_buy";

export const emptyLibrary = (): LibraryState => ({
  read: [],
  want: [],
  buy: [],
  current: null,
  notes: {},
  dragonXp: 0,
});

const LISTS: LibraryStatus[] = ["read", "want", "buy"];

/** Which list (if any) a book currently belongs to. Mutually exclusive by construction. */
export function statusOf(state: LibraryState, bookId: string): BookStatus | null {
  if (state.current?.id === bookId) return "current";
  for (const key of LISTS) if (state[key].some((b) => b.id === bookId)) return key;
  return null;
}

/**
 * Pure transition: place `book` in exactly one status, or remove it entirely
 * when `status` is null. Notes and ratings are always preserved.
 */
export function moveBook(state: LibraryState, book: Book, status: BookStatus | null): LibraryState {
  const next: LibraryState = {
    ...state,
    read: state.read.filter((b) => b.id !== book.id),
    want: state.want.filter((b) => b.id !== book.id),
    buy: state.buy.filter((b) => b.id !== book.id),
    current: state.current?.id === book.id ? null : state.current,
  };
  if (status === "current") next.current = book;
  else if (status) next[status] = [book, ...next[status]];
  return next;
}

export function addNote(state: LibraryState, bookId: string, note: Note): LibraryState {
  return { ...state, notes: { ...state.notes, [bookId]: [...(state.notes[bookId] ?? []), note] } };
}

export function removeNote(state: LibraryState, bookId: string, noteId: string): LibraryState {
  return {
    ...state,
    notes: { ...state.notes, [bookId]: (state.notes[bookId] ?? []).filter((n) => n.id !== noteId) },
  };
}

/** Union merge: remote wins on duplicates, local-only entries are kept. */
export function mergeLibraries(
  local: LibraryState,
  remote: Omit<LibraryState, "dragonXp">,
): LibraryState {
  const mergeList = (a: Book[], b: Book[]) => {
    const m = new Map<string, Book>();
    for (const x of b) m.set(x.id, x);
    for (const x of a) if (!m.has(x.id)) m.set(x.id, x);
    return [...m.values()];
  };
  const notes: Record<string, Note[]> = { ...remote.notes };
  for (const [bid, list] of Object.entries(local.notes)) {
    const existing = [...(notes[bid] ?? [])];
    const ids = new Set(existing.map((n) => n.id));
    for (const n of list) if (!ids.has(n.id)) existing.push(n);
    notes[bid] = existing;
  }
  let merged: LibraryState = {
    read: mergeList(local.read, remote.read),
    want: mergeList(local.want, remote.want),
    buy: mergeList(local.buy, remote.buy),
    current: remote.current ?? local.current,
    notes,
    dragonXp: local.dragonXp,
  };
  // Keep the invariant: the current book lives in no other list.
  if (merged.current) merged = moveBook(merged, merged.current, "current");
  return merged;
}

function isBook(v: unknown): v is Book {
  return !!v && typeof v === "object" && typeof (v as Book).id === "string";
}

export function parseLibrary(raw: string | null): LibraryState | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<LibraryState>;
    const list = (v: unknown) => (Array.isArray(v) ? v.filter(isBook) : []);
    return {
      read: list(p.read),
      want: list(p.want),
      buy: list(p.buy),
      current: isBook(p.current) ? p.current : null,
      notes: p.notes && typeof p.notes === "object" ? (p.notes as Record<string, Note[]>) : {},
      dragonXp: typeof p.dragonXp === "number" ? p.dragonXp : 0,
    };
  } catch {
    return null;
  }
}

/** Reads the saved library, falling back to the pre-v1 split keys. */
export function loadLibrary(): LibraryState {
  if (typeof window === "undefined") return emptyLibrary();
  const parsed = parseLibrary(localStorage.getItem(STORAGE_KEY));
  if (parsed) return parsed;
  const legacy = emptyLibrary();
  try {
    const notes = localStorage.getItem(LEGACY_NOTES_KEY);
    if (notes) legacy.notes = JSON.parse(notes) as Record<string, Note[]>;
    const buy = localStorage.getItem(LEGACY_BUY_KEY);
    if (buy) legacy.buy = (JSON.parse(buy) as Book[]).filter(isBook);
  } catch {
    /* ignore corrupted legacy data */
  }
  return legacy;
}

export function saveLibrary(state: LibraryState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable */
  }
}
