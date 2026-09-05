/**
 * Structural guard for PageHeader — same source-text-guard pattern as breadcrumb.test.ts /
 * back-link.test.ts (no rendering harness in this codebase).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "page-header.tsx"), "utf-8");

describe("PageHeader", () => {
  it("supports an eyebrow label and a breadcrumb override", () => {
    expect(source).toContain("eyebrow?: string");
    expect(source).toContain("breadcrumb?: ReactNode");
    expect(source).toContain("breadcrumb ?? (");
  });
  it("supports title and description", () => {
    expect(source).toContain("title: string");
    expect(source).toContain("description?: string");
  });
  it("supports primary actions, secondary actions, and a summary slot", () => {
    expect(source).toContain("primaryActions?: ReactNode");
    expect(source).toContain("secondaryActions?: ReactNode");
    expect(source).toContain("summary?: ReactNode");
  });
});
