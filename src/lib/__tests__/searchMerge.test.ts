import { describe, it, expect, vi } from "vitest";
import { progressiveSearch, mergeOrderedBatches } from "../searchMerge";
import { searchGreekBibliography } from "../greekBooks.server";
import type { Book } from "../books";

const b = (id: string, title: string, author = "A", isbn = ""): Book =>
  ({ id, title, author, isbn, genre: "", coverUrl: "", description: "" }) as Book;
const delay = <T>(ms: number, v: T) => new Promise<T>((r) => setTimeout(() => r(v), ms));

describe("mergeOrderedBatches", () => {
  it("dedupes by ISBN and title/author, earlier batch wins", () => {
    const out = mergeOrderedBatches([
      [b("g1", "Το Νησί", "Βικτόρια Χίσλοπ", "978-618-10-0185-2")],
      [b("o1", "Other", "X", "9786181001852"), b("o2", "ΤΟ ΝΗΣΙ", "βικτορια χισλοπ")],
    ]);
    expect(out.map((x) => x.id)).toEqual(["g1"]);
  });
});

describe("progressiveSearch", () => {
  it("shows fast results first, then merges slow Greek-first without duplicates", async () => {
    const updates: string[][] = [];
    const ctrl = new AbortController();
    const final = await progressiveSearch(
      [
        { run: () => delay(40, [b("gr", "Greek"), b("dup", "Shared")]) },
        { run: () => delay(5, [b("en", "English"), b("dup2", "Shared")]) },
      ],
      ctrl.signal,
      (books) => updates.push(books.map((x) => x.id)),
    );
    expect(updates[0]).toEqual(["en", "dup2"]);
    expect(final.map((x) => x.id)).toEqual(["gr", "dup", "en"]);
  });

  it("never updates after the query is aborted", async () => {
    const ctrl = new AbortController();
    const onUpdate = vi.fn();
    const p = progressiveSearch([{ run: () => delay(20, [b("x", "X")]) }], ctrl.signal, onUpdate);
    ctrl.abort();
    await p;
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("a failing source does not block others", async () => {
    const ctrl = new AbortController();
    const out = await progressiveSearch(
      [{ run: () => Promise.reject(new Error("boom")) }, { run: async () => [b("ok", "Ok")] }],
      ctrl.signal,
      () => {},
    );
    expect(out.map((x) => x.id)).toEqual(["ok"]);
  });
});

describe("searchGreekBibliography", () => {
  it("runs all filter requests in parallel", async () => {
    let inFlight = 0;
    let peak = 0;
    const fetcher = async (q: string, f: string) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await delay(20, null);
      inFlight--;
      return [b(`${q}-${f}`, `${q} ${f}`, "Author", "")];
    };
    const start = Date.now();
    const out = await searchGreekBibliography("Κρομμύδας", 20, fetcher);
    expect(peak).toBeGreaterThan(1);
    expect(Date.now() - start).toBeLessThan(80);
    expect(out.length).toBeGreaterThan(1);
  });
});
