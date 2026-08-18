/**
 * Structural regression guard for the Product Catalog table layout (horizontal-scroll fix).
 *
 * This codebase tests UI by extracting pure logic and, where a layout requirement isn't
 * expressible as a data assertion, by asserting on the component's source text — the same
 * approach used by product-cost-dialog.test.ts and the migration-shape tests. There is no
 * rendering harness for this async server component (it fetches via listCategories /
 * listProducts / getCurrentAuthState), so this file guards the specific things that caused
 * the original bug and the specific columns the fix must (and must not) produce.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "page.tsx"), "utf-8");

describe("Product Catalog — no horizontal scroll", () => {
  it("overrides the shared Table's forced min-w-max so the table can shrink to fit its container", () => {
    expect(source).toContain('<Table className="min-w-0 table-fixed">');
  });

  it("caps every column to an explicit width (fixed layout never lets content push the table wider)", () => {
    // Every TableHead (not TableHeader) in the desktop table carries a width class.
    const headBlock = source.slice(source.indexOf("<TableHeader>"), source.indexOf("</TableHeader>"));
    const headCells = headBlock.match(/<TableHead(?!er)[^>]*>/g) ?? [];
    expect(headCells.length).toBeGreaterThan(0);
    for (const cell of headCells) {
      expect(cell).toMatch(/w-16|w-12|w-\[\d+%\]/);
    }
  });

  it("truncates long product name / SKU / category text instead of forcing column width", () => {
    expect(source).toContain("truncate");
  });

  it("provides a stacked mobile card layout instead of relying on the table at narrow widths", () => {
    expect(source).toMatch(/hidden shadow-soft md:block|md:block/);
    expect(source).toContain("md:hidden");
  });
});

describe("Product Catalog — merged, compact columns", () => {
  it("renders the merged column headers", () => {
    for (const label of ["Image", "Product", "Category", "Stock", "Status", "Price"]) {
      expect(source).toMatch(new RegExp(`<TableHead[^]*?>\\s*${label}\\s*</TableHead>`));
    }
  });

  it("renders the Cost column header only inside the showCostView branch", () => {
    expect(source).toMatch(/showCostView \? <TableHead[^>]*>Cost<\/TableHead> : null/);
  });

  it("no longer renders the old separate Options / Total stock / Cost status / From price headers", () => {
    for (const oldHeader of ["Options", "Total stock", "Cost status", "From price"]) {
      expect(source).not.toContain(oldHeader);
    }
  });

  it("Stock column shows total units and option count together", () => {
    const stockCellStart = source.indexOf("{product.total_stock} units</p>");
    expect(stockCellStart).toBeGreaterThan(-1);
    const nearby = source.slice(stockCellStart, stockCellStart + 300);
    expect(nearby).toContain("option");
  });

  it("Status column includes the website status control (merged product status + website status)", () => {
    const statusBlockCount = (source.match(/<WebsiteStatusControl/g) ?? []).length;
    // Desktop table + mobile card, each render one WebsiteStatusControl per row.
    expect(statusBlockCount).toBeGreaterThanOrEqual(2);
  });

  it("Cost column renders the cost summary badge with a View-cost dialog trigger, gated by showCostView", () => {
    expect(source).toMatch(/showCostView \? \(\s*<TableCell>\s*<ProductCostDialog/);
    expect(source).toContain("costBadge.label");
  });
});

describe("Product Catalog — cost data stays permission-gated", () => {
  it("computes showCostView from canViewBuyingCost and gates every ProductCostDialog render behind it", () => {
    expect(source).toContain("const showCostView = canViewBuyingCost(userRole);");
    // Both the desktop and mobile cost triggers must be conditioned on showCostView.
    const guardedCount = (source.match(/showCostView \? \(\s*<ProductCostDialog|showCostView \? \(\s*<TableCell>\s*<ProductCostDialog/g) ?? [])
      .length;
    expect(guardedCount).toBeGreaterThanOrEqual(2);
  });

  it("never renders cost/profit figures directly in the table — only the summary badge + dialog trigger", () => {
    const tableSection = source.slice(source.indexOf("<TableHeader>"), source.indexOf("</Card>\n\n          {/* Mobile"));
    expect(tableSection).not.toContain("formatInr");
    expect(tableSection).not.toContain("totalFinalCostBhd");
  });
});
