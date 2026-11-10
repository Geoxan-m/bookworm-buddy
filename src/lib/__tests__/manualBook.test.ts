import { describe, it, expect } from "vitest";
import {
  buildManualBook,
  findDuplicate,
  manualId,
  onceAtATime,
  validateManual,
} from "../manualBook";
import { emptyLibrary, moveBook, statusOf } from "../libraryStore";

const base = { title: "Η γλώσσα των δράκων", author: "S. F. Williamson" };

describe("manual book entry", () => {
  it("requires title and author", () => {
    expect(validateManual({ title: " ", author: "" })).toEqual({
      title: "manual_err_required",
      author: "manual_err_required",
    });
    expect(validateManual(base)).toEqual({});
  });
  it("validates ISBN and HTTPS cover", () => {
    expect(validateManual({ ...base, isbn: "12345" }).isbn).toBe("manual_err_isbn");
    expect(validateManual({ ...base, coverUrl: "http://x.com/a.jpg" }).coverUrl).toBe(
      "manual_err_https",
    );
    expect(validateManual({ ...base, coverUrl: "javascript:alert(1)" }).coverUrl).toBe(
      "manual_err_https",
    );
    expect(
      validateManual({ ...base, isbn: "978-618-10-0185-2", coverUrl: "https://x.com/a.jpg" }),
    ).toEqual({});
  });
  it("normalizes ISBN", () => {
    expect(buildManualBook({ ...base, isbn: "978-618-10-0185-2" }).isbn).toBe("9786181001852");
  });
  it("generates stable IDs across formatting variants", () => {
    const a = manualId(base);
    expect(a).toMatch(/^manual:[0-9a-z]+$/);
    expect(manualId({ title: "γλωσσα των ΔΡΑΚΩΝ", author: "s f williamson" })).toBe(a);
    expect(manualId({ ...base, author: "Other" })).not.toBe(a);
    expect(manualId({ ...base, isbn: "9786181001852" })).toBe(
      manualId({ title: "x", author: "y", isbn: "978-618-10-0185-2" }),
    );
  });
  it("detects duplicates already in the library", () => {
    const b = buildManualBook(base);
    expect(findDuplicate(b, [{ ...b, id: "bn:1" }])).toBeTruthy();
    expect(findDuplicate(b, [])).toBeUndefined();
  });
  it("ignores double submission while pending", async () => {
    let calls = 0;
    let release!: () => void;
    const fn = onceAtATime(
      () =>
        new Promise<void>((r) => {
          calls++;
          release = r;
        }),
    );
    const p1 = fn();
    const p2 = await fn();
    expect(p2).toBe(false);
    release();
    expect(await p1).toBe(true);
    expect(calls).toBe(1);
  });
  it("lands in the chosen list only", () => {
    const b = buildManualBook(base);
    const empty = emptyLibrary();
    const s = moveBook(moveBook(empty, b, "want"), b, "buy");
    expect(statusOf(s, b.id)).toBe("buy");
    expect(s.want).toHaveLength(0);
  });
});
