/**
 * Structural regression guard for the report print controls (AutoPrint, ReportPrintToolbar) —
 * same source-text-guard pattern used across this codebase (no rendering harness). Both are
 * shared with the Product Catalog report, so every Stock Management-specific behavior must be
 * opt-in, with the existing defaults unchanged.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const autoPrintSource = readFileSync(join(__dirname, "auto-print.tsx"), "utf-8");
const toolbarSource = readFileSync(join(__dirname, "report-print-toolbar.tsx"), "utf-8");

describe("AutoPrint — waits for images before printing (Safari prints blank images otherwise)", () => {
  it("keeps the original quick-print behavior as the default", () => {
    expect(autoPrintSource).toContain("waitForAssets = false");
    expect(autoPrintSource).toMatch(/setTimeout\(\(\) => window\.print\(\), 150\)/);
  });

  it("waits for every image to decode and for fonts, when opted in", () => {
    expect(autoPrintSource).toContain("Array.from(document.images)");
    expect(autoPrintSource).toContain("image.decode()");
    expect(autoPrintSource).toContain("document.fonts?.ready");
  });

  it("never lets a broken or slow image block printing", () => {
    expect(autoPrintSource).toContain(".catch(() => undefined)");
    expect(autoPrintSource).toMatch(/Promise\.race\(/);
    expect(autoPrintSource).toContain("maxWaitMs = 5000");
  });

  it("does not print after the page has been left", () => {
    expect(autoPrintSource).toMatch(/if \(!cancelled\) window\.print\(\)/);
  });

  it("can be disabled (e.g. when the report failed to load)", () => {
    expect(autoPrintSource).toMatch(/if \(!enabled\) return;/);
  });
});

describe("ReportPrintToolbar — native print, optional paper-size hint", () => {
  it("keeps Back to list and Print, using the browser's native print dialog", () => {
    expect(toolbarSource).toContain("Back to list");
    expect(toolbarSource).toMatch(/onClick=\{\(\) => window\.print\(\)\}/);
  });

  it("renders a report-specific hint only when one is passed", () => {
    expect(toolbarSource).toContain("hint?: ReactNode");
    expect(toolbarSource).toMatch(/\{hint \? <div/);
  });

  it("is never printed", () => {
    expect(toolbarSource).toMatch(/className="no-print /);
  });
});

describe("Product Catalog print — untouched by the Stock Management Safari changes", () => {
  const productsPageSource = readFileSync(join(__dirname, "../../app/print/products/page.tsx"), "utf-8");

  it("keeps its own A4-landscape layout, default footer, default auto-print, and no hint", () => {
    expect(productsPageSource).toContain('pageSize="a4-landscape"');
    expect(productsPageSource).not.toContain("rowCountPlacement");
    expect(productsPageSource).not.toContain("waitForAssets");
    expect(productsPageSource).not.toContain("hint=");
    expect(productsPageSource).not.toContain("report-print-root");
    expect(productsPageSource).not.toContain("<style>");
  });
});
