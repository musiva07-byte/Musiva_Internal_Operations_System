-- Phase 11: Multi-currency pricing, inventory batches, and exchange rates.
-- Additive migration — no existing columns are dropped or renamed.
-- Old fields (cost_price, selling_price, discount_price on product_variants) are kept
-- as deprecated backfills during the transition period.

-- ============================================================
-- 1. exchange_rates
-- ============================================================
create table if not exists exchange_rates (
  id              uuid primary key default gen_random_uuid(),
  base_currency   text not null default 'BHD',
  quote_currency  text not null,
  rate            numeric(18, 6) not null check (rate > 0),
  rate_date       date not null,
  source          text not null default 'manual',
  is_manual       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists idx_exchange_rates_pair on exchange_rates(base_currency, quote_currency);
create index if not exists idx_exchange_rates_date  on exchange_rates(rate_date desc);

alter table exchange_rates enable row level security;

drop policy if exists "Authenticated staff can read exchange rates" on exchange_rates;
create policy "Authenticated staff can read exchange rates"
  on exchange_rates for select to authenticated using (true);

drop policy if exists "Authenticated staff can manage exchange rates" on exchange_rates;
create policy "Authenticated staff can manage exchange rates"
  on exchange_rates for all to authenticated using (true) with check (true);

-- ============================================================
-- 2. New enum values
-- ============================================================

-- pricing_status
do $$ begin
  if not exists (select 1 from pg_type where typname = 'pricing_status') then
    create type pricing_status as enum (
      'regular', 'discount_scheduled', 'on_sale', 'discount_ended'
    );
  end if;
end $$;

-- stock_status
do $$ begin
  if not exists (select 1 from pg_type where typname = 'stock_status') then
    create type stock_status as enum ('in_stock', 'low_stock', 'out_of_stock');
  end if;
end $$;

-- in_transit purchase status (added after 'ordered')
do $$ begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'in_transit'
      and enumtypid = (select oid from pg_type where typname = 'purchase_status')
  ) then
    alter type purchase_status add value 'in_transit' after 'ordered';
  end if;
end $$;

-- draft product status (already exists; guard avoids errors if run twice)
do $$ begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'draft'
      and enumtypid = (select oid from pg_type where typname = 'product_status')
  ) then
    alter type product_status add value 'draft' before 'active';
  end if;
end $$;

-- ============================================================
-- 3. product_variants — new pricing columns
-- ============================================================
alter table product_variants
  add column if not exists regular_selling_price_bhd  numeric(12, 3),
  add column if not exists discount_price_bhd         numeric(12, 3),
  add column if not exists discount_start_at          timestamptz,
  add column if not exists discount_end_at            timestamptz,
  add column if not exists latest_landed_cost_bhd     numeric(12, 3),
  add column if not exists average_landed_cost_bhd    numeric(12, 3);

-- Backfill from old columns so existing UI remains correct.
update product_variants
set regular_selling_price_bhd = selling_price
where regular_selling_price_bhd is null;

update product_variants
set discount_price_bhd = discount_price
where discount_price is not null and discount_price_bhd is null;

-- ============================================================
-- 4. purchase_orders — exchange rate + import cost columns
-- ============================================================
alter table purchase_orders
  add column if not exists purchase_currency       text not null default 'INR',
  add column if not exists exchange_rate_to_bhd    numeric(18, 6),
  add column if not exists exchange_rate_date      date,
  add column if not exists exchange_rate_source    text,
  add column if not exists customs_cost_bhd        numeric(12, 3) not null default 0,
  add column if not exists bank_fee_bhd            numeric(12, 3) not null default 0,
  add column if not exists packaging_cost_bhd      numeric(12, 3) not null default 0,
  add column if not exists other_import_cost_bhd   numeric(12, 3) not null default 0;

-- shipping_cost is kept as-is; application layer treats it as shipping_cost_bhd.

-- ============================================================
-- 5. purchase_order_items — per-item cost breakdown columns
-- ============================================================
alter table purchase_order_items
  add column if not exists supplier_unit_cost          numeric(14, 4),
  add column if not exists supplier_currency           text,
  add column if not exists converted_unit_cost_bhd     numeric(12, 3),
  add column if not exists allocated_import_cost_bhd   numeric(12, 3) not null default 0,
  add column if not exists landed_unit_cost_bhd        numeric(12, 3);

-- ============================================================
-- 6. inventory_batches
-- ============================================================
create table if not exists inventory_batches (
  id                        uuid primary key default gen_random_uuid(),
  purchase_order_item_id    uuid not null references purchase_order_items(id) on delete restrict,
  product_variant_id        uuid not null references product_variants(id)     on delete restrict,
  quantity_received         integer not null check (quantity_received > 0),
  quantity_remaining        integer not null check (quantity_remaining >= 0),
  supplier_unit_cost        numeric(14, 4),
  supplier_currency         text,
  exchange_rate_to_bhd      numeric(18, 6),
  converted_unit_cost_bhd   numeric(12, 3),
  allocated_import_cost_bhd numeric(12, 3) not null default 0,
  landed_unit_cost_bhd      numeric(12, 3),
  received_at               timestamptz not null default now(),
  created_at                timestamptz not null default now()
);

create index if not exists idx_inventory_batches_variant     on inventory_batches(product_variant_id);
create index if not exists idx_inventory_batches_poi         on inventory_batches(purchase_order_item_id);
create index if not exists idx_inventory_batches_received_at on inventory_batches(received_at desc);

alter table inventory_batches enable row level security;

drop policy if exists "Authenticated staff can read inventory batches" on inventory_batches;
create policy "Authenticated staff can read inventory batches"
  on inventory_batches for select to authenticated using (true);

drop policy if exists "Authenticated staff can manage inventory batches" on inventory_batches;
create policy "Authenticated staff can manage inventory batches"
  on inventory_batches for all to authenticated using (true) with check (true);

-- ============================================================
-- 7. recalculate_average_landed_cost helper
-- ============================================================
create or replace function recalculate_average_landed_cost(p_variant_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_value numeric := 0;
  v_total_qty   integer := 0;
begin
  select
    coalesce(sum(landed_unit_cost_bhd * quantity_received), 0),
    coalesce(sum(quantity_received), 0)
  into v_total_value, v_total_qty
  from inventory_batches
  where product_variant_id = p_variant_id
    and landed_unit_cost_bhd is not null
    and quantity_received > 0;

  if v_total_qty = 0 then
    return null;
  end if;

  return round(v_total_value / v_total_qty, 3);
end;
$$;

-- ============================================================
-- 8. receive_purchase_order — updated to create batches + recalc costs
--    Replaces the Phase 5 version. Old cost_price update on variant removed.
-- ============================================================
create or replace function receive_purchase_order(p_purchase_order_id uuid)
returns purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase          purchase_orders;
  v_item              purchase_order_items;
  v_previous_quantity integer;
  v_new_quantity      integer;
  v_total_received    integer := 0;
  v_avg_cost          numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into v_purchase
  from purchase_orders
  where id = p_purchase_order_id
  for update;

  if not found then
    raise exception 'Purchase order was not found.';
  end if;

  if v_purchase.status in ('received', 'cancelled') then
    raise exception 'This purchase order cannot be received.';
  end if;

  for v_item in
    select * from purchase_order_items
    where purchase_order_id = p_purchase_order_id
    order by created_at asc
  loop
    if v_item.quantity_received <= 0 then
      continue;
    end if;

    select stock_quantity into v_previous_quantity
    from product_variants
    where id = v_item.product_variant_id
    for update;

    if not found then
      raise exception 'A purchase item variant was not found.';
    end if;

    v_new_quantity := v_previous_quantity + v_item.quantity_received;

    -- Create inventory batch
    insert into inventory_batches (
      purchase_order_item_id,
      product_variant_id,
      quantity_received,
      quantity_remaining,
      supplier_unit_cost,
      supplier_currency,
      exchange_rate_to_bhd,
      converted_unit_cost_bhd,
      allocated_import_cost_bhd,
      landed_unit_cost_bhd,
      received_at
    ) values (
      v_item.id,
      v_item.product_variant_id,
      v_item.quantity_received,
      v_item.quantity_received,
      v_item.supplier_unit_cost,
      coalesce(v_item.supplier_currency, v_purchase.purchase_currency),
      v_purchase.exchange_rate_to_bhd,
      v_item.converted_unit_cost_bhd,
      v_item.allocated_import_cost_bhd,
      coalesce(v_item.landed_unit_cost_bhd, v_item.converted_unit_cost_bhd),
      now()
    );

    -- Recalculate weighted average after new batch is inserted
    v_avg_cost := recalculate_average_landed_cost(v_item.product_variant_id);

    -- Update stock and cost data without overwriting historical cost_price
    update product_variants
    set
      stock_quantity           = v_new_quantity,
      latest_landed_cost_bhd   = coalesce(v_item.landed_unit_cost_bhd, v_item.converted_unit_cost_bhd, latest_landed_cost_bhd),
      average_landed_cost_bhd  = coalesce(v_avg_cost, average_landed_cost_bhd)
    where id = v_item.product_variant_id;

    -- Stock movement record
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
    ) values (
      v_item.product_variant_id,
      'purchase_stock',
      v_item.quantity_received,
      v_previous_quantity,
      v_new_quantity,
      'purchase_order',
      p_purchase_order_id,
      'Stock received from purchase order ' || v_purchase.purchase_number || '.',
      auth.uid()
    );

    v_total_received := v_total_received + v_item.quantity_received;
  end loop;

  if v_total_received <= 0 then
    raise exception 'At least one purchase item must have received quantity.';
  end if;

  update purchase_orders
  set
    status             = 'received',
    actual_arrival_date = coalesce(actual_arrival_date, current_date)
  where id = p_purchase_order_id
  returning * into v_purchase;

  return v_purchase;
end;
$$;
