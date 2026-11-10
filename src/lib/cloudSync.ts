import { supabase } from "@/integrations/supabase/client";
import type { Book } from "@/lib/books";
import type { Note } from "@/components/CurrentBookBar";
import type { LibraryStatus, LibraryState } from "@/lib/libraryStore";

export type { LibraryStatus };

export type CloudLibrary = Omit<LibraryState, "dragonXp">;

export type CloudResult<T> = { data?: T; error?: string };

function message(e: unknown): string {
  return e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
}

export async function loadCloudLibrary(
  userId: string,
): Promise<CloudResult<CloudLibrary & { dragonXp: number }>> {
  try {
    const [ub, nt, prof] = await Promise.all([
      supabase.from("user_books").select("book_id, status, book_data").eq("user_id", userId),
      supabase.from("book_notes").select("id, book_id, body, rating").eq("user_id", userId),
      supabase
        .from("profiles")
        .select("current_book_data, dragon_xp")
        .eq("id", userId)
        .maybeSingle(),
    ]);
    const err = ub.error ?? nt.error ?? prof.error;
    if (err) return { error: err.message };

    const lib: CloudLibrary & { dragonXp: number } = {
      read: [],
      want: [],
      buy: [],
      notes: {},
      current: null,
      dragonXp: 0,
    };
    for (const r of ub.data ?? []) {
      const b = (r.book_data as Book | null) ?? null;
      if (!b) continue;
      if (r.status === "read" || r.status === "want" || r.status === "buy") lib[r.status].push(b);
    }
    for (const n of nt.data ?? []) {
      const arr = lib.notes[n.book_id] ?? [];
      arr.push({
        id: n.id,
        body: n.body,
        rating: (n as { rating?: number | null }).rating ?? null,
      });
      lib.notes[n.book_id] = arr;
    }
    lib.current = (prof.data?.current_book_data as Book | null) ?? null;
    lib.dragonXp = (prof.data?.dragon_xp as number | undefined) ?? 0;
    return { data: lib };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function upsertBook(
  userId: string,
  status: LibraryStatus,
  book: Book,
): Promise<CloudResult<true>> {
  try {
    // A book lives in exactly one list: clear other statuses first.
    const del = await supabase
      .from("user_books")
      .delete()
      .match({ user_id: userId, book_id: book.id });
    if (del.error) return { error: del.error.message };
    const { error } = await supabase
      .from("user_books")
      .insert({ user_id: userId, status, book_id: book.id, book_data: book as never });
    return error ? { error: error.message } : { data: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function removeBookEverywhere(
  userId: string,
  bookId: string,
): Promise<CloudResult<true>> {
  try {
    const { error } = await supabase
      .from("user_books")
      .delete()
      .match({ user_id: userId, book_id: bookId });
    return error ? { error: error.message } : { data: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function addCloudNote(
  userId: string,
  bookId: string,
  note: Note,
): Promise<CloudResult<true>> {
  try {
    const { error } = await supabase.from("book_notes").insert({
      id: note.id,
      user_id: userId,
      book_id: bookId,
      body: note.body,
      rating: note.rating ?? null,
    });
    return error ? { error: error.message } : { data: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function deleteCloudNote(userId: string, noteId: string): Promise<CloudResult<true>> {
  try {
    const { error } = await supabase
      .from("book_notes")
      .delete()
      .match({ user_id: userId, id: noteId });
    return error ? { error: error.message } : { data: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function setCurrentBookCloud(
  userId: string,
  book: Book | null,
): Promise<CloudResult<true>> {
  try {
    if (book) {
      const del = await supabase
        .from("user_books")
        .delete()
        .match({ user_id: userId, book_id: book.id });
      if (del.error) return { error: del.error.message };
    }
    const { error } = await supabase
      .from("profiles")
      .update({ current_book_id: book?.id ?? null, current_book_data: (book as never) ?? null })
      .eq("id", userId);
    return error ? { error: error.message } : { data: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function setDragonXp(userId: string, xp: number): Promise<CloudResult<true>> {
  try {
    const { error } = await supabase.from("profiles").update({ dragon_xp: xp }).eq("id", userId);
    return error ? { error: error.message } : { data: true };
  } catch (e) {
    return { error: message(e) };
  }
}
