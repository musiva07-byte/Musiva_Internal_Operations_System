/**
 * Structural regression guard for BrandMark — same source-text-guard pattern as
 * product-cost-dialog.test.ts (no rendering harness in this codebase).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "brand-mark.tsx"), "utf-8");

describe("BrandMark — configurable subtitle, safe default", () => {
  it("accepts a subtitle prop and defaults it to 'Bahrain Boutique'", () => {
    expect(source).toMatch(/subtitle\s*=\s*"Bahrain Boutique"/);
  });

  it("renders the subtitle prop, not a hardcoded string, in the header markup", () => {
    expect(source).toContain("{subtitle}");
  });

  it("always shows the Moosiva Lux Wear name", () => {
    expect(source).toContain("Moosiva Lux Wear");
  });
});
