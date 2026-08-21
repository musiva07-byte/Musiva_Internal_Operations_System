/**
 * Structural regression guard for the Product Catalog Report print page — same source-text-
 * guard pattern as product-cost-dialog.test.ts (no rendering harness in this codebase).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "page.tsx"), "utf-8");

describe("Print Products page — no sidebar, no admin chrome, no action buttons", () => {
  it("does not render the admin sidebar/layout", () => {
    expect(source).not.toContain("AdminSidebar");
    expect(source).not.toContain("/components/admin/");
  });

  it("does not render product management actions (edit, delete, archive, add variant)", () => {
    for (const forbidden of ["ProductRowActions", "New product", "Edit product", "Archive product"]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("uses the print toolbar (Back + Print, hidden via .no-print at print time)", () => {
    expect(source).toContain("ReportPrintToolbar");
  });
});

describe("Print Products page — real data, correct report identity", () => {
  it("fetches real filtered data via listProductsForExport — never a hardcoded row array", () => {
    expect(source).toContain("listProductsForExport(");
    expect(source).not.toMatch(/const\s+\w*[Pp]roducts\w*\s*=\s*\[\s*\{/);
  });

  it("uses the exact required report title", () => {
    expect(source).toContain('"Product Catalog Report"');
  });

  it("gates columns through the shared permission-aware print builder, not ad-hoc logic", () => {
    expect(source).toContain("getProductCatalogPrintColumns(role)");
    expect(source).toContain("buildProductCatalogPrintRow(item, role)");
  });

  it("shows generated date/time and active filters", () => {
    expect(source).toContain("generatedAt={new Date()}");
    expect(source).toContain("filters={filters}");
  });

  it("renders in landscape so the extra cost/profit columns don't clip", () => {
    expect(source).toMatch(/\blandscape\b/);
  });

  it("surfaces a load error as a friendly message instead of printing garbage/empty data", () => {
    expect(source).toContain("exportResult.error");
    expect(source).toMatch(/AutoPrint enabled=\{!exportResult\.error\}/);
  });
});
