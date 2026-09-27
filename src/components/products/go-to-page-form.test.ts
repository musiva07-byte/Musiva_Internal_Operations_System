/**
 * Structural guard for GoToPageForm — the one interactive piece of Pagination, split into its
 * own client component because Pagination itself must stay a plain (server-renderable)
 * component: every caller is a Server Component page.tsx passing a plain `href` function prop,
 * and functions cannot be passed from a Server Component to a Client Component. This exact
 * mistake (making Pagination itself "use client" while still receiving `href` as a function
 * prop) was caught live during QA — "Functions cannot be passed directly to Client Components".
 * Real validation logic is unit-tested in src/lib/utils/pagination.test.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "go-to-page-form.tsx"), "utf-8");

describe("GoToPageForm", () => {
  it('is a client component ("use client" at the top)', () => {
    expect(source.trimStart().startsWith('"use client";')).toBe(true);
  });

  it("takes a plain serializable sampleHref string, not a function", () => {
    expect(source).toContain("{ pageCount, sampleHref }: { pageCount: number; sampleHref: string }");
  });

  it("validates input via parseGoToPage before navigating, and shows an inline error instead of a raw crash", () => {
    expect(source).toContain("parseGoToPage(value, pageCount)");
    expect(source).toContain("setError(result.error)");
  });

  it("disables native HTML validation (noValidate) so an out-of-range value always shows the custom friendly message instead of a silent browser-native block", () => {
    expect(source).toContain("noValidate");
  });

  it("builds the target URL by editing the page query param on the sample href, then navigates", () => {
    expect(source).toContain('const url = new URL(sampleHref, "http://localhost");');
    expect(source).toContain('url.searchParams.set("page", String(result.page));');
    expect(source).toContain("router.push(`${url.pathname}${url.search}`);");
  });

  it("clears the typed value and error after a successful navigation", () => {
    expect(source).toContain('setValue("")');
  });
});
