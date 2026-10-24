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

describe("Print Inventory page — Safari-safe print setup", () => {
  const cssSource = readFileSync(join(__dirname, "..", "..", "globals.css"), "utf-8");
  const printBlock = cssSource.slice(cssSource.indexOf("@media print {"));

  it("does not rely solely on the named @page: renders its own unnamed A3-landscape @page", () => {
    expect(source).toMatch(/STOCK_REPORT_PAGE_CSS = `@media print \{ @page \{ size: A3 landscape; margin: 10mm; \} \}`/);
    expect(source).toContain("<style>{STOCK_REPORT_PAGE_CSS}</style>");
  });

  it("keeps the A3 @page rule out of globals.css's unnamed default, so invoices/labels stay A4 portrait", () => {
    expect(printBlock).toMatch(/@page\s*\{\s*size:\s*A4 portrait/);
    expect(printBlock).not.toMatch(/@page\s*\{\s*size:\s*A3/);
  });

  it("prints fluid — 100% of the printable area, never the fixed 420mm desktop box", () => {
    expect(printBlock).toMatch(/\.print-a3-landscape\.print-page\s*\{\s*width:\s*auto;\s*min-height:\s*0;/);
    expect(printBlock).not.toMatch(/\.print-a3-landscape\.print-page\s*\{\s*width:\s*420mm/);
    expect(printBlock).toMatch(/\.print-a3-landscape \.print-table\s*\{\s*width:\s*100%;/);
  });

  it("resets the app-wide html/body overflow clipping for this report only (scoped via :has)", () => {
    expect(printBlock).toMatch(
      /html:has\(\.print-a3-landscape\),\s*html:has\(\.print-a3-landscape\) body\s*\{[^}]*overflow:\s*visible/,
    );
  });

  it("removes the screen wrapper's min-height/padding in print (Safari blank-last-page source)", () => {
    expect(source).toContain('className="report-print-root');
    expect(printBlock).toMatch(/\.report-print-root\s*\{\s*min-height:\s*0;\s*padding:\s*0;/);
  });

  it("repeats the table header and avoids splitting rows, with legacy page-break-* for WebKit", () => {
    expect(printBlock).toMatch(/\.print-table thead\s*\{\s*display:\s*table-header-group;/);
    expect(printBlock).toMatch(/\.print-a3-landscape \.print-table tr\s*\{\s*page-break-inside:\s*avoid;\s*break-inside:\s*avoid;/);
  });

  it("keeps the row count in the header so no footer can orphan onto a blank last page", () => {
    expect(source).toContain('rowCountPlacement="header"');
  });

  it("keeps the missing-image placeholder visible in Safari print", () => {
    expect(printBlock).toMatch(/\.print-a3-landscape \.report-thumb-placeholder\s*\{[^}]*-webkit-print-color-adjust:\s*exact/);
  });

  it("uses no transforms or zoom hacks to force the table to fit", () => {
    expect(printBlock).not.toMatch(/\btransform\s*:|\bzoom\s*:/);
  });

  it("waits for product images before opening the print dialog", () => {
    expect(source).toMatch(/<AutoPrint enabled=\{!exportResult\.error\} waitForAssets \/>/);
  });

  it("shows the paper-size hint, including the A4 guidance, without removing columns", () => {
    expect(source).toContain("Recommended: A3 • Landscape • Fit to page");
    expect(source).toContain("Only A4 paper available?");
    expect(source).toContain("all 15");
    expect(source).toContain("hint={<PrintSetupHint />}");
  });
});

describe("Print Inventory page — compact columns never clip", () => {
  const cssSource = readFileSync(join(__dirname, "..", "..", "globals.css"), "utf-8");

  it("text cells wrap long words instead of overflowing into the next column", () => {
    expect(cssSource).toMatch(/\.report-compact \.print-table td\s*\{[^}]*overflow-wrap:\s*anywhere/);
  });

  it("the thumbnail is a square that scales with the table, never stretched or wider than its cell", () => {
    expect(cssSource).toMatch(
      /\.report-compact \.report-thumb\s*\{\s*width:\s*2\.646cqi;\s*max-width:\s*100%;\s*height:\s*auto;\s*aspect-ratio:\s*1 \/ 1;/,
    );
    expect(cssSource).toMatch(/\.report-thumb-img\s*\{[^}]*object-fit:\s*cover/);
  });

  it("never hides overflow as a workaround — no hidden overflow or ellipsis on table cells", () => {
    const tdRule = /\.report-compact \.print-table td\s*\{([^}]*)\}/.exec(cssSource)![1];
    expect(tdRule).not.toMatch(/overflow:\s*hidden/);
    expect(tdRule).not.toMatch(/text-overflow/);
  });
});

describe("Print Inventory page — type scales with the page (fits every paper, Safari-safe)", () => {
  const cssSource = readFileSync(join(__dirname, "..", "..", "globals.css"), "utf-8");

  it("makes the report sheet the size container for the table's type", () => {
    expect(cssSource).toMatch(/\.report-compact\s*\{\s*container-type:\s*inline-size;/);
  });

  it("sizes table text, headers and padding in container units calibrated to 14px / 12px on the A3 basis", () => {
    expect(cssSource).toMatch(/\.report-compact \.print-table\s*\{\s*font-size:\s*0\.926cqi;/);
    expect(cssSource).toMatch(/\.report-compact \.print-table th\s*\{\s*font-size:\s*0\.794cqi;/);
    expect(cssSource).toMatch(/\.report-compact \.print-table td\s*\{\s*padding:\s*0\.265cqi;/);
    // 0.926% of the 1512px A3 printable width ≈ 14px; 0.794% ≈ 12px.
    expect(0.00926 * 1512).toBeCloseTo(14, 0);
    expect(0.00794 * 1512).toBeCloseTo(12, 0);
  });

  it("keeps the header inside the sheet: brand and title shrink/wrap instead of overflowing", () => {
    expect(cssSource).toMatch(/\.report-compact \.print-header > \*\s*\{\s*min-width:\s*0;/);
  });

  it("does not force breaks after the header (avoid-breaks there can leave page 1 half-empty)", () => {
    expect(cssSource).not.toMatch(/\.print-a3-landscape \.print-header\s*\{[^}]*break-after/);
  });

  it("tells staff how to turn off Safari's own headers and footers (the site cannot)", () => {
    expect(source).toContain("click Show Details and turn off");
    expect(source).toContain("Print headers and");
  });
});
