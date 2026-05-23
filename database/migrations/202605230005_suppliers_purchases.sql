-- Phase 7: Suppliers and Purchases
-- Purchase receiving is handled through RPC so stock and movement rows stay consistent.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'purchase_status') then
    create type purchase_status as enum ('draft', 'ordered', 'partially_received', 'received', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'purchase_payment_status') then
    create type purchase_payment_status as enum ('unpaid', 'partial', 'paid');
  end if;
end $$;

create sequence if not exists purchase_number_seq start with 10001 increment by 1;

create or replace function generate_purchase_number()
returns text
language sql
as $$
  select 'PO-' || nextval('purchase_number_seq')::text;
$$;

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  contact_person text,
  phone text,
  email text,
  country text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  purchase_number text not null unique default generate_purchase_number(),
  supplier_id uuid not null references suppliers(id) on delete restrict,
  purchase_date date not null default current_date,
  expected_arrival_date date,
  actual_arrival_date date,
  status purchase_status not null default 'draft',
  payment_status purchase_payment_status not null default 'unpaid',
  subtotal numeric(12, 3) not null default 0 check (subtotal >= 0),
  discount numeric(12, 3) not null default 0 check (discount >= 0),
  shipping_cost numeric(12, 3) not null default 0 check (shipping_cost >= 0),
  grand_total numeric(12, 3) not null default 0 check (grand_total >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_variant_id uuid not null references product_variants(id) on delete restrict,
  quantity_ordered integer not null check (quantity_ordered > 0),
  quantity_received integer not null default 0 check (quantity_received >= 0),
  cost_price numeric(12, 3) not null check (cost_price >= 0),
  line_total numeric(12, 3) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

drop trigger if exists suppliers_set_updated_at on suppliers;
create trigger suppliers_set_updated_at
before update on suppliers
for each row execute function set_updated_at();

drop trigger if exists purchase_orders_set_updated_at on purchase_orders;
create trigger purchase_orders_set_updated_at
before update on purchase_orders
for each row execute function set_updated_at();

create index if not exists idx_suppliers_name on suppliers using gin (to_tsvector('simple', supplier_name));
create index if not exists idx_suppliers_phone on suppliers(phone);
create index if not exists idx_purchase_orders_number on purchase_orders(purchase_number);
create index if not exists idx_purchase_orders_supplier on purchase_orders(supplier_id);
create index if not exists idx_purchase_orders_status on purchase_orders(status);
create index if not exists idx_purchase_orders_payment_status on purchase_orders(payment_status);
create index if not exists idx_purchase_orders_purchase_date on purchase_orders(purchase_date);
create index if not exists idx_purchase_order_items_purchase on purchase_order_items(purchase_order_id);
create index if not exists idx_purchase_order_items_variant on purchase_order_items(product_variant_id);

create or replace function receive_purchase_order(p_purchase_order_id uuid)
returns purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase purchase_orders;
  v_item purchase_order_items;
  v_previous_quantity integer;
  v_new_quantity integer;
  v_total_received integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select *
    into v_purchase
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
    select *
    from purchase_order_items
    where purchase_order_id = p_purchase_order_id
    order by created_at asc
  loop
    if v_item.quantity_received <= 0 then
      continue;
    end if;

    select stock_quantity
      into v_previous_quantity
    from product_variants
    where id = v_item.product_variant_id
    for update;

    if not found then
      raise exception 'A purchase item variant was not found.';
    end if;

    v_new_quantity := v_previous_quantity + v_item.quantity_received;

    update product_variants
    set
      stock_quantity = v_new_quantity,
      cost_price = v_item.cost_price
    where id = v_item.product_variant_id;

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
    status = 'received',
    actual_arrival_date = coalesce(actual_arrival_date, current_date)
  where id = p_purchase_order_id
  returning * into v_purchase;

  return v_purchase;
end;
$$;

alter table suppliers enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;

drop policy if exists "Authenticated staff can read suppliers" on suppliers;
create policy "Authenticated staff can read suppliers"
on suppliers for select to authenticated using (true);

drop policy if exists "Authenticated staff can manage suppliers" on suppliers;
create policy "Authenticated staff can manage suppliers"
on suppliers for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated staff can read purchase orders" on purchase_orders;
create policy "Authenticated staff can read purchase orders"
on purchase_orders for select to authenticated using (true);

drop policy if exists "Authenticated staff can manage purchase orders" on purchase_orders;
create policy "Authenticated staff can manage purchase orders"
on purchase_orders for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated staff can read purchase order items" on purchase_order_items;
create policy "Authenticated staff can read purchase order items"
on purchase_order_items for select to authenticated using (true);

drop policy if exists "Authenticated staff can manage purchase order items" on purchase_order_items;
create policy "Authenticated staff can manage purchase order items"
on purchase_order_items for all to authenticated using (true) with check (true);
