/**
 * Structural guard for the enhanced Product Catalog pagination (direct page numbers, Go to
 * page, "Showing X–Y of Z", mobile compact view). The page-number and Go-to-page *logic* is
 * unit-tested with real assertions in src/lib/utils/pagination.test.ts; this file locks down
 * that the component actually wires that logic into the rendered controls correctly — same
 * source-text-guard pattern as breadcrumb.test.ts (no rendering harness in this codebase).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "pagination.tsx"), "utf-8");

describe("Pagination — page numbers", () => {
  it("returns null (renders nothing) when there is only one page", () => {
    expect(source).toContain("if (pageCount <= 1) {\n    return null;\n  }");
  });

  it("renders page numbers via getPageNumbers, including ellipsis handling", () => {
    expect(source).toContain("getPageNumbers(page, pageCount)");
    expect(source).toContain("entry === ELLIPSIS");
  });

  it("highlights the current page with aria-current and a distinct variant", () => {
    expect(source).toContain('variant={entry === page ? "default" : "outline"}');
    expect(source).toContain('aria-current={entry === page ? "page" : undefined}');
  });

  it("every page-number link is built from the caller's href() function, so filters/search are preserved by construction", () => {
    expect(source).toContain("<Link href={href(entry)}");
  });
});

describe("Pagination — Previous/Next are genuinely disabled at the boundaries", () => {
  it("Previous renders a real disabled <button> (not a styled, still-clickable <a>) on page 1", () => {
    expect(source).toContain("disabled={page <= 1}");
    expect(source).toContain("<Button disabled size=\"sm\" variant=\"outline\" type=\"button\">");
  });

  it("Next is disabled the same way on the last page", () => {
    expect(source).toContain("disabled={page >= pageCount}");
  });

  it("PrevNextButton renders a real Link (not disabled markup) when not at a boundary", () => {
    expect(source).toMatch(/if \(disabled\) \{[\s\S]*?<Button disabled[\s\S]*?\}\s*return \(\s*<Button asChild/);
  });
});

describe("Pagination — Go to page", () => {
  it("only shows the Go-to-page input when there are more than 5 pages", () => {
    expect(source).toContain("const showGoToPage = pageCount > 5;");
    expect(source).toContain("{showGoToPage && <GoToPageForm pageCount={pageCount} sampleHref={href(1)} />}");
  });

  it("is NOT a client component itself — every caller is a Server Component passing a plain href function, which cannot cross into a Client Component", () => {
    expect(source).not.toContain('"use client"');
  });

  it("delegates the interactive part to GoToPageForm, passing a plain string (href(1)) rather than the function", () => {
    expect(source).toContain('import { GoToPageForm } from "@/components/products/go-to-page-form"');
  });
});

describe("Pagination — showing range and mobile compact view", () => {
  it('shows "Showing X–Y of Z" only when both totalCount and pageSize are provided', () => {
    expect(source).toContain("totalCount !== undefined && pageSize !== undefined");
    expect(source).toContain("`Showing ${start}–${end} of ${totalCount}`");
  });

  it("renders a compact Previous / Page x of y / Next block for mobile, hidden page-number list on mobile", () => {
    expect(source).toContain('className="flex items-center gap-2 sm:hidden"');
    expect(source).toContain('className="hidden items-center gap-1.5 sm:flex sm:flex-wrap"');
  });
});
