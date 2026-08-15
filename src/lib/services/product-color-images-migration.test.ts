/**
 * Static checks on the color-images migration SQL (202607171700_product_color_images.sql).
 *
 * Same approach as ecommerce-publishing-migration.test.ts: no live-database test harness
 * exists in this project, so these tests parse the migration file's text and assert its
 * additive shape and public-safety contract. Not proof of runtime behavior — that must be
 * verified against a real Supabase project when the migration is actually applied (it has
 * not been, and this task does not apply it — see the final report for the manual step).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  __dirname,
  "../../../database/migrations/202607171700_product_color_images.sql",
);
const sql = readFileSync(migrationPath, "utf-8");

describe("color-images migration — additive shape", () => {
  it("adds the color column with 'if not exists' (safe to re-run, never fails if already applied)", () => {
    expect(sql).toMatch(/alter table product_images add column if not exists color text;/);
  });

  it("never drops or renames an existing column", () => {
    expect(sql).not.toMatch(/drop column/i);
    expect(sql).not.toMatch(/rename column/i);
    expect(sql).not.toMatch(/rename to/i);
  });

  it("never drops a table", () => {
    expect(sql).not.toMatch(/drop table/i);
  });

  it("replaces the too-strict one-image-per-product index with two correctly-scoped partial ones", () => {
    expect(sql).toMatch(/drop index if exists uniq_product_images_product_id;/);
    expect(sql).toMatch(
      /create unique index if not exists uniq_product_images_main\s+on product_images\(product_id\)\s+where color is null;/,
    );
    expect(sql).toMatch(
      /create unique index if not exists uniq_product_images_color\s+on product_images\(product_id, color\)\s+where color is not null;/,
    );
  });

  it("still enforces at most one main image per product (existing single-image products need no backfill)", () => {
    // Every pre-migration row has color = NULL, so uniq_product_images_main alone already
    // matches today's "one image per product" invariant for every existing product.
    expect(sql).toContain("where color is null");
  });
});

describe("color-images migration — public website safety", () => {
  function extractView(name: string): string {
    const pattern = new RegExp(`create or replace view ${name} as[\\s\\S]*?;`);
    const match = sql.match(pattern);
    if (!match) {
      throw new Error(`View "${name}" not found in migration.`);
    }
    return match[0];
  }

  const FORBIDDEN_COLUMNS = [
    "cost_price",
    "latest_landed_cost_bhd",
    "average_landed_cost_bhd",
    "latest_supplier_unit_cost_inr",
    "latest_exchange_rate_to_bhd",
    "latest_additional_landed_cost_bhd",
    "variant_sku",
    "barcode",
    "minimum_stock",
    "i.path",
    "i.variant_id",
  ];

  it("public_product_images gains color but still excludes every forbidden/internal column", () => {
    const view = extractView("public_product_images");
    expect(view).toContain("i.color");
    for (const column of FORBIDDEN_COLUMNS) {
      expect(view).not.toContain(column);
    }
  });

  it("still requires the parent product to be public (predicate untouched)", () => {
    const view = extractView("public_product_images");
    expect(view).toMatch(/exists \(select 1 from public_products pp where pp\.id = i\.product_id\)/);
  });

  it("does not add any new grant statements — public_product_images was already granted to anon", () => {
    expect(sql).not.toMatch(/^grant /im);
  });
});
