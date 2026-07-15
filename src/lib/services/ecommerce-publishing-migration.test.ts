/**
 * Static checks on the ecommerce publishing migration SQL.
 *
 * There is no live-database test harness in this project (vitest runs in a
 * plain "node" environment with no Postgres instance), so these tests
 * cannot exercise real RLS/view behavior end to end. Instead they parse the
 * migration file's text and assert its declared defaults, view predicates,
 * and grants match the required contract. Treat this as a guard against
 * accidental typos in the migration (e.g. a flipped default), not as proof
 * of runtime behavior — that must be verified against a real Supabase
 * project before/while applying the migration.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  __dirname,
  "../../../database/migrations/202607150001_ecommerce_publishing.sql",
);
const sql = readFileSync(migrationPath, "utf-8");

function extractView(name: string): string {
  // Every view body in this migration is a single statement with no nested
  // semicolons, so the first ";" after the view's "as" reliably ends it.
  const pattern = new RegExp(`create or replace view ${name} as[\\s\\S]*?;`);
  const match = sql.match(pattern);
  if (!match) {
    throw new Error(`View "${name}" not found in migration.`);
  }
  return match[0];
}

// ── 1. New columns exist with safe (non-public) defaults ─────────────────────

describe("ecommerce publishing migration — new columns", () => {
  it("adds website_visible defaulting to false", () => {
    expect(sql).toMatch(/website_visible\s+boolean not null default false/);
  });

  it("adds online_status defaulting to 'hidden'", () => {
    expect(sql).toMatch(/online_status\s+product_online_status not null default 'hidden'/);
  });

  it("restricts online_status to draft/published/hidden", () => {
    expect(sql).toMatch(/create type product_online_status as enum \('draft', 'published', 'hidden'\)/);
  });

  it("adds slug as nullable (backfilled separately, not defaulted)", () => {
    expect(sql).toMatch(/add column if not exists slug\s+text,/);
  });

  it("adds featured and new_arrival defaulting to false", () => {
    expect(sql).toMatch(/featured\s+boolean not null default false/);
    expect(sql).toMatch(/new_arrival\s+boolean not null default false/);
  });

  it("has an explicit safety-net statement forcing existing rows hidden", () => {
    expect(sql).toMatch(
      /update products\s+set website_visible = false,\s+online_status = 'hidden'/,
    );
  });

  it("never drops or renames an existing table", () => {
    expect(sql.toLowerCase()).not.toMatch(/drop table/);
    expect(sql.toLowerCase()).not.toMatch(/rename to/);
  });
});

// ── 2. Indexes ─────────────────────────────────────────────────────────────

describe("ecommerce publishing migration — indexes", () => {
  it("adds a unique index on slug", () => {
    expect(sql).toMatch(/create unique index if not exists idx_products_slug_unique\s+on products\(slug\)/);
  });

  it("adds the website-visibility composite index", () => {
    expect(sql).toMatch(
      /create index if not exists idx_products_website_visibility\s+on products\(status, website_visible, online_status\)/,
    );
  });

  it("adds the product_variants public-lookup composite index", () => {
    expect(sql).toMatch(
      /create index if not exists idx_product_variants_public_lookup\s+on product_variants\(product_id, status, stock_quantity\)/,
    );
  });

  it("adds the product_images public-lookup composite index", () => {
    expect(sql).toMatch(
      /create index if not exists idx_product_images_public_lookup\s+on product_images\(product_id, is_primary, sort_order\)/,
    );
  });
});

// ── 3. Public view visibility predicates ──────────────────────────────────

describe("public_products view", () => {
  const view = extractView("public_products");

  it("requires an active product status", () => {
    expect(view).toMatch(/p\.status = 'active'/);
  });

  it("requires website_visible = true", () => {
    expect(view).toMatch(/p\.website_visible = true/);
  });

  it("requires online_status = published", () => {
    expect(view).toMatch(/p\.online_status = 'published'/);
  });

  it("requires slug is not null", () => {
    expect(view).toMatch(/p\.slug is not null/);
  });

  it("requires the category (when present) to be active", () => {
    expect(view).toMatch(/c\.status = 'active'/);
  });

  it("requires at least one active variant with stock", () => {
    expect(view).toMatch(/v\.status = 'active'\s+and v\.stock_quantity > 0/);
  });
});

describe("public_product_variants view", () => {
  const view = extractView("public_product_variants");

  it("requires the variant to be active with stock", () => {
    expect(view).toMatch(/v\.status = 'active'/);
    expect(view).toMatch(/v\.stock_quantity > 0/);
  });

  it("requires the parent product to be public", () => {
    expect(view).toMatch(/exists \(select 1 from public_products pp where pp\.id = v\.product_id\)/);
  });
});

describe("public_product_images and public_categories views", () => {
  it("images require the parent product to be public", () => {
    const view = extractView("public_product_images");
    expect(view).toMatch(/exists \(select 1 from public_products pp where pp\.id = i\.product_id\)/);
  });

  it("categories require active status and at least one public product", () => {
    const view = extractView("public_categories");
    expect(view).toMatch(/c\.status = 'active'/);
    expect(view).toMatch(/exists \(select 1 from public_products pp where pp\.category_id = c\.id\)/);
  });
});

// ── 4. No internal/cost fields in any public view ─────────────────────────

const FORBIDDEN_COLUMNS = [
  "cost_price",
  "latest_landed_cost_bhd",
  "average_landed_cost_bhd",
  "variant_sku",
  "barcode",
  "minimum_stock",
  "p.sku",
  "i.path",
  "i.variant_id",
  "business_address",
  "invoice_footer",
  "return_policy_text",
  "default_delivery_charge",
  "low_stock_default_quantity",
  "receipt_theme",
  "logo_path",
];

describe("public views never select internal/cost columns", () => {
  const viewNames = [
    "public_products",
    "public_product_variants",
    "public_product_images",
    "public_categories",
    "public_site_settings",
  ];

  for (const name of viewNames) {
    it(`${name} excludes every forbidden column`, () => {
      const view = extractView(name);
      for (const column of FORBIDDEN_COLUMNS) {
        expect(view).not.toContain(column);
      }
    });
  }
});

// ── 5. Anon grants target only the public views, never base tables ────────

describe("anon grants", () => {
  const grantLines = sql
    .split("\n")
    .filter((line) => /^grant select on .* to anon;/.test(line.trim()));

  it("grants select to anon on exactly the five public views", () => {
    const granted = grantLines.map((line) => line.replace(/^grant select on\s+/, "").replace(/\s+to anon;$/, ""));
    expect(granted.sort()).toEqual(
      [
        "public_products",
        "public_product_variants",
        "public_product_images",
        "public_categories",
        "public_site_settings",
      ].sort(),
    );
  });

  it("never grants anon access directly to a base table", () => {
    const baseTables = ["products", "product_variants", "product_images", "categories", "settings"];
    for (const line of grantLines) {
      for (const table of baseTables) {
        expect(line.trim()).not.toBe(`grant select on ${table} to anon;`);
      }
    }
  });
});
