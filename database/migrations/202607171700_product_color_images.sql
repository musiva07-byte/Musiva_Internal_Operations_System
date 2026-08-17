-- ============================================================
-- Color-level product images.
--
-- product_images already had a nullable variant_id column (never used so far).
-- Rather than requiring an image per exact variant, this adds a nullable
-- `color` column so one image can be attached to a color value (e.g. "Black")
-- and shared by every variant of that color — matching how Moosiva actually
-- photographs stock (per color, not per size).
--
-- product_images previously had a hard "exactly one image per product" rule
-- (uniq_product_images_product_id, added in 202607060004). That rule is too
-- strict for this feature: it would reject inserting a second row (a color
-- image) for a product that already has a main image. It is replaced with
-- two partial unique indexes that together allow exactly what's needed and
-- nothing more:
--   - at most one "main" image per product (rows where color IS NULL)
--   - at most one image per (product, color) combination
-- Both are still hard database guarantees, just scoped correctly.
--
-- Purely additive: no column is dropped or renamed, no row is deleted, and
-- every existing single-image product already satisfies both new indexes
-- (its one row has color IS NULL, so it becomes that product's "main" image
-- automatically — no backfill needed).
-- ============================================================

alter table product_images add column if not exists color text;

drop index if exists uniq_product_images_product_id;

create unique index if not exists uniq_product_images_main
  on product_images(product_id)
  where color is null;

create unique index if not exists uniq_product_images_color
  on product_images(product_id, color)
  where color is not null;

create index if not exists idx_product_images_color on product_images(product_id, color);

-- ── Public website safety ────────────────────────────────────────────────────
-- Color is a plain display attribute (not cost/profit/internal data), so it's safe
-- to expose the same way url/is_primary/sort_order already are. This is the same
-- create-or-replace-view pattern 202607150001_ecommerce_publishing.sql already uses
-- for iterative, additive view changes — no grant changes needed, the view is
-- already granted to anon.

-- Column order matters here: CREATE OR REPLACE VIEW only allows appending new columns
-- at the end of the existing column list — it cannot insert a column in the middle
-- (Postgres treats that as renaming the column already in that position, which errors
-- with 42P16). The live view's existing order is id, product_id, url, is_primary,
-- sort_order, so `color` is appended after sort_order rather than before is_primary.
create or replace view public_product_images as
select
  i.id,
  i.product_id,
  i.url,
  i.is_primary,
  i.sort_order,
  i.color
from product_images i
where exists (select 1 from public_products pp where pp.id = i.product_id);
