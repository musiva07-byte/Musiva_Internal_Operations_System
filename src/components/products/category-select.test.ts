/**
 * Structural regression guard for the "+ Add new category" flow.
 *
 * This codebase has no rendering-test harness (see other *.test.ts files — UI is tested by
 * extracting pure logic, or, when that isn't possible, by guarding the source text the same
 * way product-cost-dialog.test.ts does). The interesting *behavior* here — validation and
 * duplicate detection — is pure and already covered end-to-end in
 * category.schema.test.ts (validateNewCategoryName) and category-creation.test.ts
 * (createCategory). What's left to guard is the wiring: that the dropdown still lists
 * existing categories, that "+ Add new category" opens a modal instead of navigating away,
 * that a newly-created category is auto-selected without touching any other form field, and
 * that both the product-create wizard and the product-edit form actually use this component.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const categorySelectSource = readFileSync(join(__dirname, "category-select.tsx"), "utf-8");
const wizardSource = readFileSync(join(__dirname, "product-wizard.tsx"), "utf-8");
const formSource = readFileSync(join(__dirname, "product-form.tsx"), "utf-8");

describe("CategorySelect — dropdown and add-new-category wiring", () => {
  it("still renders the existing category list as options", () => {
    expect(categorySelectSource).toMatch(/categories\.map\(/);
    expect(categorySelectSource).toContain("Uncategorized");
  });

  it("adds a '+ Add new category' option to the dropdown", () => {
    expect(categorySelectSource).toContain("+ Add new category");
  });

  it("opens a modal (not a page navigation) when '+ Add new category' is selected", () => {
    expect(categorySelectSource).toContain("Dialog");
    expect(categorySelectSource).toContain("setOpen(true)");
    expect(categorySelectSource).toContain("Category name");
    expect(categorySelectSource).toMatch(/Save category/);
    expect(categorySelectSource).toMatch(/Cancel/);
  });

  it("validates the name before calling the server (blocks empty/duplicate before a round trip)", () => {
    expect(categorySelectSource).toContain("validateNewCategoryName");
  });

  it("auto-selects the newly created category via onChange", () => {
    expect(categorySelectSource).toMatch(/onChange\(created\.id\)/);
  });

  it("shows a success message after saving", () => {
    expect(categorySelectSource).toContain("Category added.");
  });

  it("never navigates or reloads the page — adding a category cannot reset the surrounding form", () => {
    expect(categorySelectSource).not.toMatch(/router\.(refresh|push|replace)/);
    expect(categorySelectSource).not.toMatch(/window\.location/);
  });

  it("falls back to showing an unrecognized selected category instead of silently dropping it", () => {
    expect(categorySelectSource).toContain("hasUnknownSelection");
    expect(categorySelectSource).toMatch(/currentCategoryName/);
  });
});

describe("Product create wizard — category field", () => {
  it("uses CategorySelect for the category field", () => {
    expect(wizardSource).toMatch(/import\s*\{\s*CategorySelect\s*\}/);
    expect(wizardSource).toMatch(/<CategorySelect/);
  });

  it("still wires the selected category into the product-create payload", () => {
    expect(wizardSource).toMatch(/categoryId:\s*step1\.categoryId/);
  });
});

describe("Product edit form — category field", () => {
  it("uses CategorySelect (via a react-hook-form Controller) for the category field", () => {
    expect(formSource).toMatch(/import\s*\{\s*CategorySelect\s*\}/);
    expect(formSource).toMatch(/<CategorySelect/);
    expect(formSource).toContain('name="categoryId"');
  });

  it("passes the current product's category name so an old/archived category still displays", () => {
    expect(formSource).toMatch(/currentCategoryName=\{product\?\.category\?\.name\}/);
  });
});
