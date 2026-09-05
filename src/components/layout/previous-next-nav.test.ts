/**
 * Structural guard for PreviousNextNav — extracted from the order detail page's original inline
 * implementation. Same source-text-guard pattern as breadcrumb.test.ts / back-link.test.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "previous-next-nav.tsx"), "utf-8");

describe("PreviousNextNav", () => {
  it("accepts previous/next items and a href builder", () => {
    expect(source).toContain("previous: AdjacentItem");
    expect(source).toContain("next: AdjacentItem");
    expect(source).toContain("hrefFor: (id: string) => string");
  });
  it("renders a disabled (non-link) state when an item is missing", () => {
    expect(source).toMatch(/previous \? \(/);
    expect(source).toMatch(/next \? \(/);
  });
  it("supports custom labels, defaulting to Previous/Next", () => {
    expect(source).toContain('previousLabel = "Previous"');
    expect(source).toContain('nextLabel = "Next"');
  });
});
