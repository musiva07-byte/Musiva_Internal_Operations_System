/**
 * Structural regression guard for the shared BackLink component — same source-text-guard
 * pattern as product-cost-dialog.test.ts (no rendering harness in this codebase).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "back-link.tsx"), "utf-8");

describe("BackLink", () => {
  it("renders as a real link (never requires the browser back button)", () => {
    expect(source).toContain('import Link from "next/link"');
    expect(source).toContain("<Link");
  });

  it("shows a leading arrow icon plus the caller-provided label", () => {
    expect(source).toContain("ArrowLeft");
    expect(source).toContain("{label}");
  });
});
