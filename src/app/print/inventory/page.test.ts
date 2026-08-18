/**
 * Structural regression guard for the Stock Management Report print page — same source-
 * text-guard pattern as product-cost-dialog.test.ts (no rendering harness in this codebase).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "page.tsx"), "utf-8");

describe("Print Inventory page — no sidebar, no admin chrome, no action buttons", () => {
  it("does not render the admin sidebar/layout", () => {
    expect(source).not.toContain("AdminSidebar");
    expect(source).not.toContain("/components/admin/");
  });

  it("does not render inventory management actions (add stock, adjust, receive)", () => {
    for (const forbidden of ["Add stock", "Receive stock", "Correct stock quantity", "QuickAddStockDialog"]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("uses the print toolbar (Back + Print, hidden via .no-print at print time)", () => {
    expect(source).toContain("ReportPrintToolbar");
  });
});

describe("Print Inventory page — real data, correct report identity", () => {
  it("fetches real filtered data via listInventoryVariantsForExport — never a hardcoded row array", () => {
    expect(source).toContain("listInventoryVariantsForExport(");
    expect(source).not.toMatch(/const\s+\w*[Vv]ariants\w*\s*=\s*\[\s*\{/);
  });

  it("uses the exact required report title", () => {
    expect(source).toContain('"Stock Management Report"');
  });

  it("gates columns through the shared permission-aware builder, not ad-hoc logic", () => {
    expect(source).toContain("getStockManagementColumns(role)");
    expect(source).toContain("buildStockManagementRow(variant, role)");
  });

  it("shows generated date/time and active filters", () => {
    expect(source).toContain("generatedAt={new Date()}");
    expect(source).toContain("filters={filters}");
  });

  it("surfaces a load error as a friendly message instead of printing garbage/empty data", () => {
    expect(source).toContain("exportResult.error");
    expect(source).toMatch(/AutoPrint enabled=\{!exportResult\.error\}/);
  });
});
