-- Ecommerce publishing support for the future public website (www.moosivabh.com).
-- Additive only: no existing table is dropped, renamed, or rewritten, and no
-- existing product/stock/order/customer workflow is changed.
--
-- Safety: every new product column defaults to "not public" (website_visible
-- = false, online_status = 'hidden'), so every existing product remains
-- hidden from the public website after this migration runs. Nothing becomes
-- publicly visible automatically — staff must opt each product in.

-- ============================================================
-- 1. New ecommerce publishing columns on products
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'product_online_status'
  ) then
    create type product_online_status as enum ('draft', 'published', 'hidden');
  end if;
end $$;

alter table products
  add column if not exists slug                 text,
  add column if not exists website_visible       boolean not null default false,
  add column if not exists online_status         product_online_status not null default 'hidden',
  add column if not exists website_title         text,
  add column if not exists website_description   text,
  add column if not exists seo_title             text,
  add column if not exists seo_description        text,
  add column if not exists featured              boolean not null default false,
  add column if not exists new_arrival           boolean not null default false,
  add column if not exists sort_order            integer not null default 0;

-- ============================================================
-- 2. Backfill slug for existing products
-- ============================================================
-- Rules: lowercase, trim, spaces -> hyphens, strip unsafe characters.
-- Duplicates get the product's SKU appended (slugified) to stay unique.
-- Every product currently has slug is null (column was just added), so this
-- only ever assigns a slug once per row here — it never overwrites a
-- staff-entered slug, matching "do not change slug automatically after a
-- product is published unless the user explicitly edits it."

with base as (
  select
    id,
    sku,
    created_at,
    nullif(
      trim(both '-' from
        regexp_replace(
          regexp_replace(lower(trim(name)), '[^a-z0-9\s-]', '', 'g'),
          '\s+', '-', 'g'
        )
      ),
      ''
    ) as base_slug
  from products
  where slug is null
),
normalized as (
  select
    id,
    created_at,
    coalesce(base_slug, 'product-' || lower(regexp_replace(sku, '[^a-zA-Z0-9]+', '-', 'g'))) as base_slug,
    lower(regexp_replace(sku, '[^a-zA-Z0-9]+', '-', 'g')) as slug_sku
  from base
),
ranked as (
  select
    id,
    base_slug,
    slug_sku,
    row_number() over (partition by base_slug order by created_at, id) as rn
  from normalized
)
update products p
set slug = case when r.rn = 1 then r.base_slug else r.base_slug || '-' || r.slug_sku end
from ranked r
where p.id = r.id;

-- If two different products still collide after the SKU suffix (extremely
-- unlikely — SKUs are unique), the unique index below fails loudly instead
-- of silently corrupting data. Re-run this migration's backfill block by
-- hand for the affected rows if that ever happens.

-- ============================================================
-- 3. Existing products remain hidden
-- ============================================================
-- No UPDATE needed: website_visible/online_status just got column defaults
-- of false/'hidden' above, which Postgres applies to every existing row as
-- part of adding the column. This statement is a redundant, explicit
-- safety net in case a future edit to this migration changes the defaults
-- above without updating this comment.

update products
set website_visible = false,
    online_status = 'hidden'
where website_visible is distinct from false
   or online_status is distinct from 'hidden';

-- ============================================================
-- 4. Indexes
-- ============================================================

-- Unique index on slug (partial: only enforced once a slug is set) also
-- serves as the "products(slug)" lookup index requested for the public
-- product-detail query — a second plain index on the same column would be
-- redundant.
create unique index if not exists idx_products_slug_unique
  on products(slug) where slug is not null;

create index if not exists idx_products_website_visibility
  on products(status, website_visible, online_status);

-- categories.slug already has a UNIQUE constraint from the original Phase 2
-- migration (202605230002_products_inventory.sql), which already created
-- its own unique index — no separate index needed here.

create index if not exists idx_product_variants_public_lookup
  on product_variants(product_id, status, stock_quantity);

create index if not exists idx_product_images_public_lookup
  on product_images(product_id, is_primary, sort_order);

-- ============================================================
-- 5. Public-safe views
-- ============================================================
-- SECURITY MODEL: these views are owned by the migration role (which has
-- BYPASSRLS in Supabase), so querying them does NOT go through the
-- authenticated-only RLS policies on the underlying tables. The WHERE
-- clause below IS the security boundary, not RLS. Anything selected here
-- is exposed to anonymous website visitors — never add a column without
-- checking it against the internal-fields list at the bottom of this file.
--
-- Visibility rules (must match context describing the public website):
--   product public  <=> status = 'active' AND website_visible = true
--                       AND online_status = 'published' AND slug is not null
--                       AND (no category OR category is active)
--                       AND at least one active variant has stock_quantity > 0
--   variant public  <=> parent product is public AND variant status = 'active'
--                       AND stock_quantity > 0
--   image public    <=> parent product is public
--   category public <=> category.status = 'active' AND has >= 1 public product

create or replace view public_products as
select
  p.id,
  p.name,
  p.slug,
  p.category_id,
  p.collection,
  p.description,
  p.material,
  p.care_instructions,
  p.website_title,
  p.website_description,
  p.seo_title,
  p.seo_description,
  p.featured,
  p.new_arrival,
  p.sort_order
from products p
where p.status = 'active'
  and p.website_visible = true
  and p.online_status = 'published'
  and p.slug is not null
  and (
    p.category_id is null
    or exists (
      select 1 from categories c
      where c.id = p.category_id and c.status = 'active'
    )
  )
  and exists (
    select 1 from product_variants v
    where v.product_id = p.id
      and v.status = 'active'
      and v.stock_quantity > 0
  );

create or replace view public_product_variants as
select
  v.id,
  v.product_id,
  v.color,
  v.size,
  v.regular_selling_price_bhd,
  v.discount_price_bhd,
  v.discount_start_at,
  v.discount_end_at,
  v.stock_quantity
from product_variants v
where v.status = 'active'
  and v.stock_quantity > 0
  and exists (select 1 from public_products pp where pp.id = v.product_id);

create or replace view public_product_images as
select
  i.id,
  i.product_id,
  i.url,
  i.is_primary,
  i.sort_order
from product_images i
where exists (select 1 from public_products pp where pp.id = i.product_id);

create or replace view public_categories as
select
  c.id,
  c.name,
  c.slug,
  c.description,
  c.sort_order
from categories c
where c.status = 'active'
  and exists (select 1 from public_products pp where pp.category_id = c.id);

create or replace view public_site_settings as
select
  s.business_name,
  s.logo_url,
  s.whatsapp_number,
  s.instagram_handle
from settings s
order by s.created_at asc
limit 1;

-- Never selected above (and must never be added to these views):
--   product_variants.cost_price, selling_price, discount_price (deprecated),
--   latest_landed_cost_bhd, average_landed_cost_bhd, minimum_stock,
--   variant_sku, barcode
--   products.sku
--   product_images.path, variant_id
--   settings.business_address, invoice_footer, return_policy_text,
--   default_delivery_charge, currency, low_stock_default_quantity,
--   receipt_theme, logo_path, id, created_at, updated_at
--   any purchase_orders / purchase_order_items / inventory_batches /
--   suppliers / exchange_rates / profiles / roles / permissions /
--   audit_logs / stock_movements row

-- ============================================================
-- 6. Anon read grants — views only, never the base tables
-- ============================================================

grant select on public_products to anon;
grant select on public_product_variants to anon;
grant select on public_product_images to anon;
grant select on public_categories to anon;
grant select on public_site_settings to anon;
