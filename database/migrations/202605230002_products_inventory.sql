-- Phase 2: Products and Inventory
-- Variant stock is the source of truth. Product rows never store stock quantity.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'product_status') then
    create type product_status as enum ('active', 'inactive', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'product_variant_status') then
    create type product_variant_status as enum ('active', 'inactive', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'stock_movement_type') then
    create type stock_movement_type as enum (
      'opening_stock',
      'purchase_stock',
      'sale_deduction',
      'return_added',
      'exchange_deduction',
      'damaged',
      'manual_adjustment',
      'cancelled_order_restore'
    );
  end if;
end $$;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  status product_status not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text not null unique,
  category_id uuid references categories(id) on delete set null,
  collection text,
  description text,
  material text,
  care_instructions text,
  status product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_sku text not null unique,
  barcode text unique,
  color text not null,
  size text not null,
  cost_price numeric(12, 3) not null default 0 check (cost_price >= 0),
  selling_price numeric(12, 3) not null check (selling_price >= 0),
  discount_price numeric(12, 3) check (discount_price is null or discount_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  minimum_stock integer not null default 0 check (minimum_stock >= 0),
  status product_variant_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_unique_option unique (product_id, color, size)
);

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  url text not null,
  path text not null,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references product_variants(id) on delete restrict,
  movement_type stock_movement_type not null,
  quantity integer not null,
  previous_quantity integer not null check (previous_quantity >= 0),
  new_quantity integer not null check (new_quantity >= 0),
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stock_movements_quantity_not_zero check (quantity <> 0)
);

create index if not exists idx_categories_status on categories(status);
create index if not exists idx_products_name on products using gin (to_tsvector('simple', name));
create index if not exists idx_products_sku on products(sku);
create index if not exists idx_products_category on products(category_id);
create index if not exists idx_products_status on products(status);
create index if not exists idx_product_images_product on product_images(product_id);
create index if not exists idx_product_images_variant on product_images(variant_id);

-- Required by AGENTS.md for Phase 2 tables.
create index if not exists idx_product_variants_sku on product_variants(variant_sku);
create index if not exists idx_product_variants_barcode on product_variants(barcode);
create index if not exists idx_product_variants_product on product_variants(product_id);
create index if not exists idx_product_variants_stock on product_variants(stock_quantity, minimum_stock);
create index if not exists idx_stock_movements_variant on stock_movements(product_variant_id);
create index if not exists idx_stock_movements_created_at on stock_movements(created_at);
create index if not exists idx_stock_movements_type on stock_movements(movement_type);

-- The remaining required AGENTS.md indexes reference orders, customers, and deliveries.
-- They belong in the Phase 3 and Phase 5 migrations where those tables are created.

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists categories_set_updated_at on categories;
create trigger categories_set_updated_at
before update on categories
for each row execute function set_updated_at();

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
before update on products
for each row execute function set_updated_at();

drop trigger if exists product_variants_set_updated_at on product_variants;
create trigger product_variants_set_updated_at
before update on product_variants
for each row execute function set_updated_at();

create or replace function add_variant_stock(
  p_variant_id uuid,
  p_quantity integer,
  p_movement_type stock_movement_type,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_note text default null
)
returns stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_quantity integer;
  v_new_quantity integer;
  v_movement stock_movements;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if p_quantity <= 0 then
    raise exception 'Stock entry quantity must be greater than zero.';
  end if;

  select stock_quantity
    into v_previous_quantity
  from product_variants
  where id = p_variant_id
  for update;

  if not found then
    raise exception 'Product variant was not found.';
  end if;

  v_new_quantity := v_previous_quantity + p_quantity;

  update product_variants
  set stock_quantity = v_new_quantity
  where id = p_variant_id;

  insert into stock_movements (
    product_variant_id,
    movement_type,
    quantity,
    previous_quantity,
    new_quantity,
    reference_type,
    reference_id,
    note,
    created_by
  )
  values (
    p_variant_id,
    p_movement_type,
    p_quantity,
    v_previous_quantity,
    v_new_quantity,
    p_reference_type,
    p_reference_id,
    p_note,
    auth.uid()
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

create or replace function adjust_variant_stock(
  p_variant_id uuid,
  p_new_quantity integer,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_note text default null
)
returns stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_quantity integer;
  v_delta integer;
  v_movement stock_movements;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if p_new_quantity < 0 then
    raise exception 'New stock quantity cannot be negative.';
  end if;

  select stock_quantity
    into v_previous_quantity
  from product_variants
  where id = p_variant_id
  for update;

  if not found then
    raise exception 'Product variant was not found.';
  end if;

  v_delta := p_new_quantity - v_previous_quantity;

  if v_delta = 0 then
    raise exception 'New stock quantity must be different from the current quantity.';
  end if;

  update product_variants
  set stock_quantity = p_new_quantity
  where id = p_variant_id;

  insert into stock_movements (
    product_variant_id,
    movement_type,
    quantity,
    previous_quantity,
    new_quantity,
    reference_type,
    reference_id,
    note,
    created_by
  )
  values (
    p_variant_id,
    'manual_adjustment',
    v_delta,
    v_previous_quantity,
    p_new_quantity,
    p_reference_type,
    p_reference_id,
    p_note,
    auth.uid()
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

alter table categories enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_images enable row level security;
alter table stock_movements enable row level security;

drop policy if exists "Authenticated staff can read categories" on categories;
create policy "Authenticated staff can read categories"
on categories for select
to authenticated
using (true);

drop policy if exists "Authenticated staff can read products" on products;
create policy "Authenticated staff can read products"
on products for select
to authenticated
using (true);

drop policy if exists "Authenticated staff can read product variants" on product_variants;
create policy "Authenticated staff can read product variants"
on product_variants for select
to authenticated
using (true);

drop policy if exists "Authenticated staff can read product images" on product_images;
create policy "Authenticated staff can read product images"
on product_images for select
to authenticated
using (true);

drop policy if exists "Authenticated staff can read stock movements" on stock_movements;
create policy "Authenticated staff can read stock movements"
on stock_movements for select
to authenticated
using (true);

-- Phase 2 placeholders: tighten these to role-aware checks after profiles/roles policies are finalized.
drop policy if exists "Authenticated staff can manage categories" on categories;
create policy "Authenticated staff can manage categories"
on categories for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated staff can manage products" on products;
create policy "Authenticated staff can manage products"
on products for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated staff can manage product variants" on product_variants;
create policy "Authenticated staff can manage product variants"
on product_variants for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated staff can manage product images" on product_images;
create policy "Authenticated staff can manage product images"
on product_images for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated staff can insert stock movements through services" on stock_movements;
create policy "Authenticated staff can insert stock movements through services"
on stock_movements for insert
to authenticated
with check (created_by = auth.uid());

insert into categories (name, slug, sort_order)
values
  ('Dresses', 'dresses', 10),
  ('Abayas', 'abayas', 20),
  ('Tops', 'tops', 30),
  ('Bottoms', 'bottoms', 40),
  ('Bags', 'bags', 50),
  ('Accessories', 'accessories', 60),
  ('Luxury Wear', 'luxury-wear', 70),
  ('New Collection', 'new-collection', 80)
on conflict (slug) do nothing;
