/**
 * Structural regression guard for the shared Breadcrumb component — same source-text-guard
 * pattern as product-cost-dialog.test.ts (no rendering harness in this codebase).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "breadcrumb.tsx"), "utf-8");

describe("Breadcrumb — hierarchy trail", () => {
  it("renders every segment, only linking segments that have an href and aren't last", () => {
    expect(source).toContain("segment.href && !isLast");
  });

  it("never links the last (current-page) segment even if it has an href", () => {
    expect(source).toMatch(/isLast[\s\S]*aria-current/);
  });

  it("uses a chevron separator between segments", () => {
    expect(source).toContain("ChevronRight");
  });

  it("labels the nav landmark for accessibility", () => {
    expect(source).toContain('aria-label="Breadcrumb"');
  });
});
