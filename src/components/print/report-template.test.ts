/**
 * Structural regression guard for ReportTemplate's new compact "stock-number" cell kind — same
 * source-text-guard pattern as other components in this codebase (no rendering harness).
 * Introduced for the Stock Management print/PDF report layout rework: the Stock column must
 * show a bare, colored number (0 = red/bold, 1-2 = normal dark, 3+ = green/bold) with no
 * "unit(s)"/"Low Stock"/"Out of Stock" text and no pill/badge chrome.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "report-template.tsx"), "utf-8");

describe("ReportTemplate — stock-number cell (compact Stock column)", () => {
  it("defines a dedicated cell kind, separate from the verbose badge cell", () => {
    expect(source).toContain('kind: "stock-number"');
    expect(source).toContain("ReportStockNumberCell");
  });

  it("tone thresholds match the spec exactly: 0 = zero, 1-2 = low, 3+ = ok, negative = invalid", () => {
    expect(source).toMatch(/if \(quantity < 0\) return "invalid";/);
    expect(source).toMatch(/if \(quantity === 0\) return "zero";/);
    expect(source).toMatch(/if \(quantity <= 2\) return "low";/);
    expect(source).toContain('return "ok"');
  });

  it("renders only the bare number — no unit text, no badge/pill wrapper class", () => {
    expect(source).toMatch(/report-stock-number report-stock-number--\$\{stockNumberTone\(cell\.quantity\)\}/);
    expect(source).toMatch(/\{cell\.quantity\}\s*<\/span>/);
    expect(source).not.toMatch(/stock-number[^}]*report-badge/);
  });

  it("stock-number cells are a distinct branch from the badge-cell branch (badge wording kept for other reports)", () => {
    const badgeIdx = source.indexOf("isBadgeCell(cell)");
    const stockIdx = source.indexOf("isStockNumberCell(cell)");
    expect(badgeIdx).toBeGreaterThan(-1);
    expect(stockIdx).toBeGreaterThan(badgeIdx);
  });
});
