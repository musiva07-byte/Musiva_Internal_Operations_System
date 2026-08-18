/**
 * Structural regression guard for the Stock Management CSV export route — same source-text-
 * guard pattern as product-cost-dialog.test.ts. The actual column/permission logic is
 * exhaustively tested in lib/reports/stock-management-report.test.ts; this file only checks
 * that the route wires to it correctly (auth check, real data, friendly error, filename).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "route.ts"), "utf-8");

describe("Stock Management CSV export route", () => {
  it("requires an authenticated staff profile before exporting anything", () => {
    expect(source).toMatch(/getCurrentAuthState/);
    expect(source).toMatch(/if \(!profile\)/);
  });

  it("gates columns through the shared permission-aware builder, not ad-hoc logic", () => {
    expect(source).toContain("getStockManagementColumns(profile.role)");
    expect(source).toContain("buildStockManagementRow(variant, profile.role)");
  });

  it("fetches real filtered data via listInventoryVariantsForExport — never a hardcoded row array", () => {
    expect(source).toContain("listInventoryVariantsForExport(");
    expect(source).not.toMatch(/const\s+\w*[Rr]ows\w*\s*=\s*\[\s*\{/);
  });

  it("uses the required filename convention", () => {
    expect(source).toContain('csvFilename("stock-management")');
  });

  it("shows the exact required friendly error message and logs the real error server-side", () => {
    expect(source).toContain(
      "Could not export the report. Please try again or contact the administrator.",
    );
    expect(source).toMatch(/console\.error\(/);
  });

  it("never returns raw database error details to the client", () => {
    expect(source).not.toMatch(/error:\s*(err|error)\.message/);
  });
});
