import { describe, it, expect } from "vitest";
import {
  emptyLibrary,
  moveBook,
  statusOf,
  parseLibrary,
  mergeLibraries,
  addNote,
} from "../libraryStore";
import type { Book } from "../books";

const b = (id: string): Book => ({
  id,
  isbn: "",
  title: id,
  author: "a",
  genre: "g",
  coverUrl: "",
  description: "",
});

describe("moveBook", () => {
  it("keeps a book in exactly one list", () => {
    let s = moveBook(emptyLibrary(), b("x"), "read");
    s = moveBook(s, b("x"), "want");
    s = moveBook(s, b("x"), "current");
    expect(s.read).toHaveLength(0);
    expect(s.want).toHaveLength(0);
    expect(s.current?.id).toBe("x");
    s = moveBook(s, b("x"), "buy");
    expect(s.current).toBeNull();
    expect(statusOf(s, "x")).toBe("buy");
  });
  it("removes but preserves notes", () => {
    let s = addNote(moveBook(emptyLibrary(), b("x"), "read"), "x", {
      id: "n",
      body: "hi",
      rating: 4,
    });
    s = moveBook(s, b("x"), null);
    expect(statusOf(s, "x")).toBeNull();
    expect(s.notes.x[0].rating).toBe(4);
  });
});

describe("persistence", () => {
  it("round-trips and rejects garbage", () => {
    const s = { ...moveBook(emptyLibrary(), b("x"), "want"), dragonXp: 3 };
    expect(parseLibrary(JSON.stringify(s))).toEqual(s);
    expect(parseLibrary("{bad")).toBeNull();
    expect(parseLibrary(JSON.stringify({ read: [1, null] }))?.read).toEqual([]);
  });
  it("merge keeps current exclusive", () => {
    const local = moveBook(emptyLibrary(), b("x"), "read");
    const m = mergeLibraries(local, { ...emptyLibrary(), current: b("x") });
    expect(m.read).toHaveLength(0);
    expect(m.current?.id).toBe("x");
  });
});
