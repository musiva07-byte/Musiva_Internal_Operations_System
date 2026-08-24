/**
 * Structural regression guard for ProductThumbnail — the shared image cell used by Product
 * Catalog, Stock Management, and Receive Stock. Confirms it never passes a falsy src to
 * next/image (which throws for an empty/missing src) — it must show a placeholder instead.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "product-thumbnail.tsx"), "utf-8");

describe("ProductThumbnail — placeholder for missing/invalid image URL", () => {
  it("returns a placeholder before ever reaching the <Image> element when url is falsy", () => {
    expect(source).toMatch(/if \(!url\) \{[\s\S]*?return \([\s\S]*?ImageOff/);
  });

  it("only renders <Image src={url}> after that falsy-url guard, never with a fallback to an empty string", () => {
    expect(source).not.toMatch(/src=\{[^}]*\?\?\s*""\s*\}/);
    expect(source).toContain("src={url}");
  });
});
