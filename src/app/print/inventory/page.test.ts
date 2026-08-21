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

  it("gates columns through the shared permission-aware print builder, not ad-hoc logic", () => {
    expect(source).toContain("getStockManagementPrintColumns(role)");
    expect(source).toContain("buildStockManagementPrintRow(variant, role)");
  });

  it("shows generated date/time and active filters", () => {
    expect(source).toContain("generatedAt={new Date()}");
    expect(source).toContain("filters={filters}");
  });

  it("renders in A3 landscape so all 15 columns fit without cramming", () => {
    expect(source).toContain('pageSize="a3-landscape"');
  });

  it("uses the compact table mode for the wide cost/profit breakdown", () => {
    expect(source).toMatch(/\bcompact\b/);
  });

  it("wraps the report in the screen-only horizontal-scroll safety net", () => {
    expect(source).toContain("print-preview-scroll");
  });

  it("surfaces a load error as a friendly message instead of printing garbage/empty data", () => {
    expect(source).toContain("exportResult.error");
    expect(source).toMatch(/AutoPrint enabled=\{!exportResult\.error\}/);
  });
});

describe("Print Inventory page — CSS backs the A3 landscape layout", () => {
  const cssSource = readFileSync(join(__dirname, "..", "..", "globals.css"), "utf-8");

  it("defines an A3 landscape @page rule", () => {
    expect(cssSource).toMatch(/@page\s+report-landscape-a3\s*\{[^}]*size:\s*A3 landscape/);
  });

  it("sizes the A3 print page box to match", () => {
    expect(cssSource).toMatch(/\.print-a3-landscape\.print-page\s*\{[^}]*width:\s*420mm/);
  });

  it("defines the compact report mode (smaller font/padding/thumbnail)", () => {
    expect(cssSource).toContain(".report-compact .print-table {");
    expect(cssSource).toContain(".report-compact .report-thumb {");
  });
});
