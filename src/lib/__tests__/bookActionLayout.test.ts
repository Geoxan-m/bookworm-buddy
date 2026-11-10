import { describe, expect, it } from "vitest";
import { ACTION_BUTTON_CLASS, ACTION_GRID_CLASS, ACTION_ICON_CLASS } from "@/lib/bookActionLayout";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The book dialog is max-w-lg; these guard the layout regression where four
// viewport-switched columns pushed the Greek labels outside their buttons.
describe("book dialog action layout", () => {
  it("keeps the actions in a fixed two-column grid with no 4-column breakpoint", () => {
    expect(ACTION_GRID_CLASS).toContain("grid-cols-2");
    expect(ACTION_GRID_CLASS).not.toMatch(/grid-cols-4/);
    expect(ACTION_GRID_CLASS).not.toMatch(/\b(sm|md|lg|xl):/);
  });

  it("lets long Greek and English labels wrap and stay centred", () => {
    expect(ACTION_BUTTON_CLASS).toContain("whitespace-normal");
    expect(ACTION_BUTTON_CLASS).toContain("text-center");
    expect(ACTION_BUTTON_CLASS).toContain("leading-tight");
    expect(ACTION_BUTTON_CLASS).toContain("break-words");
  });

  it("uses an auto height above a 40px minimum", () => {
    expect(ACTION_BUTTON_CLASS).toContain("h-auto");
    expect(ACTION_BUTTON_CLASS).toContain("min-h-10");
    expect(ACTION_BUTTON_CLASS).not.toMatch(/(^|\s)h-\d+(\s|$)/);
  });

  it("keeps the icon from shrinking", () => {
    expect(ACTION_ICON_CLASS).toContain("shrink-0");
  });

  it("still wins over the base button nowrap and fixed height after merging", () => {
    const merged = cn(buttonVariants({ size: "sm", className: ACTION_BUTTON_CLASS }));
    expect(merged).toContain("whitespace-normal");
    expect(merged).not.toContain("whitespace-nowrap");
    expect(merged).toContain("h-auto");
    expect(merged).not.toContain("h-8");
    expect(merged).toContain("min-h-10");
  });
});
