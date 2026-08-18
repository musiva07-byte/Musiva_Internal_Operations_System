/**
 * Structural regression guard for the shared Export ▾ menu (Print current list / Download
 * PDF / Download CSV) — same source-text-guard pattern as product-cost-dialog.test.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "export-menu.tsx"), "utf-8");

describe("ExportMenu — required actions", () => {
  it("offers Print current list, Download PDF, and Download CSV", () => {
    expect(source).toContain("Print current list");
    expect(source).toContain("Download PDF");
    expect(source).toContain("Download CSV");
  });

  it("labels PDF as browser Save as PDF (no PDF generation library in this project)", () => {
    expect(source).toMatch(/Save as PDF/i);
  });
});

describe("ExportMenu — error handling", () => {
  it("shows the exact required friendly error message on export failure", () => {
    expect(source).toContain(
      "Could not export the report. Please try again or contact the administrator.",
    );
  });

  it("catches a failed CSV fetch instead of letting it navigate to a raw error response", () => {
    expect(source).toMatch(/if \(!response\.ok\)/);
    expect(source).toMatch(/catch \(err\)/);
  });

  it("logs the real error to the console while showing only the friendly message to staff", () => {
    expect(source).toMatch(/console\.error\(/);
  });
});
