-- Phase 3: Customers and Orders
-- Orders use a sequence-backed MSV-10001 format. Stock deduction is server-side through RPC.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_source') then
    create type order_source as enum ('instagram', 'whatsapp', 'website', 'walk_in', 'tiktok', 'referral', 'other');
  end if;

  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum (
      'new',
      'confirmed',
      'packed',
      'ready_for_pickup',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'returned',
      'exchange_requested'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type payment_method as enum (
      'cash',
      'benefitpay',
      'card',
      'bank_transfer',
      'payment_link',
      'cash_on_delivery'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('unpaid', 'paid', 'partial', 'cod', 'refunded');
  end if;

  if not exists (select 1 from pg_type where typname = 'delivery_status') then
    create type delivery_status as enum (
      'pending',
      'packed',
      'ready_for_pickup',
      'with_courier',
      'out_for_delivery',
      'delivered',
      'failed',
      'returned'
    );
  end if;
end $$;

create sequence if not exists order_number_seq start with 10001 increment by 1;

create or replace function generate_order_number()
returns text
language sql
as $$
  select 'MSV-' || nextval('order_number_seq')::text;
$$;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  mobile text not null unique,
  whatsapp text,
  email text,
  area text,
  governorate text,
  block text,
  road text,
  building text,
  flat text,
  landmark text,
  delivery_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default generate_order_number(),
  customer_id uuid not null references customers(id) on delete restrict,
  order_source order_source not null,
  order_status order_status not null default 'new',
  payment_status payment_status not null default 'unpaid',
  payment_method payment_method,
  subtotal numeric(12, 3) not null default 0 check (subtotal >= 0),
  discount_total numeric(12, 3) not null default 0 check (discount_total >= 0),
  delivery_charge numeric(12, 3) not null default 0 check (delivery_charge >= 0),
  grand_total numeric(12, 3) not null default 0 check (grand_total >= 0),
  amount_paid numeric(12, 3) not null default 0 check (amount_paid >= 0),
  amount_due numeric(12, 3) not null default 0 check (amount_due >= 0),
  staff_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_variant_id uuid not null references product_variants(id) on delete restrict,
  product_name_snapshot text not null,
  variant_sku_snapshot text not null,
  size_snapshot text not null,
  color_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 3) not null check (unit_price >= 0),
  discount numeric(12, 3) not null default 0 check (discount >= 0),
  line_total numeric(12, 3) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  payment_method payment_method not null,
  payment_status payment_status not null,
  amount numeric(12, 3) not null default 0 check (amount >= 0),
  reference_number text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  customer_name text not null,
  phone text not null,
  governorate text,
  area text,
  block text,
  road text,
  building text,
  flat text,
  landmark text,
  delivery_note text,
  delivery_date date,
  delivery_time_slot text,
  courier_name text,
  courier_phone text,
  delivery_status delivery_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  table_name text,
  record_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists customers_set_updated_at on customers;
create trigger customers_set_updated_at
before update on customers
for each row execute function set_updated_at();

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at
before update on orders
for each row execute function set_updated_at();

drop trigger if exists deliveries_set_updated_at on deliveries;
create trigger deliveries_set_updated_at
before update on deliveries
for each row execute function set_updated_at();

-- Required AGENTS.md indexes.
create index if not exists idx_orders_order_number on orders(order_number);
create index if not exists idx_orders_created_at on orders(created_at);
create index if not exists idx_orders_order_status on orders(order_status);
create index if not exists idx_orders_payment_status on orders(payment_status);
create index if not exists idx_customers_mobile on customers(mobile);
create index if not exists idx_deliveries_status on deliveries(delivery_status);
create index if not exists idx_deliveries_date on deliveries(delivery_date);

create index if not exists idx_customers_name on customers using gin (to_tsvector('simple', full_name));
create index if not exists idx_orders_customer on orders(customer_id);
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_order_items_variant on order_items(product_variant_id);
create index if not exists idx_payments_order on payments(order_id);
create index if not exists idx_audit_logs_action on audit_logs(action);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at);

create or replace function deduct_variant_stock(
  p_variant_id uuid,
  p_quantity integer,
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
    raise exception 'Deduction quantity must be greater than zero.';
  end if;

  select stock_quantity
    into v_previous_quantity
  from product_variants
  where id = p_variant_id
  for update;

  if not found then
    raise exception 'Product variant was not found.';
  end if;

  if v_previous_quantity < p_quantity then
    raise exception 'Not enough stock available.';
  end if;

  v_new_quantity := v_previous_quantity - p_quantity;

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
    'sale_deduction',
    -p_quantity,
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

alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table deliveries enable row level security;
alter table audit_logs enable row level security;

drop policy if exists "Authenticated staff can read customers" on customers;
create policy "Authenticated staff can read customers"
on customers for select to authenticated using (true);

drop policy if exists "Authenticated staff can manage customers" on customers;
create policy "Authenticated staff can manage customers"
on customers for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated staff can read orders" on orders;
create policy "Authenticated staff can read orders"
on orders for select to authenticated using (true);

drop policy if exists "Authenticated staff can manage orders" on orders;
create policy "Authenticated staff can manage orders"
on orders for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated staff can read order items" on order_items;
create policy "Authenticated staff can read order items"
on order_items for select to authenticated using (true);

drop policy if exists "Authenticated staff can manage order items" on order_items;
create policy "Authenticated staff can manage order items"
on order_items for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated staff can read payments" on payments;
create policy "Authenticated staff can read payments"
on payments for select to authenticated using (true);

drop policy if exists "Authenticated staff can manage payments" on payments;
create policy "Authenticated staff can manage payments"
on payments for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated staff can read deliveries" on deliveries;
create policy "Authenticated staff can read deliveries"
on deliveries for select to authenticated using (true);

drop policy if exists "Authenticated staff can manage deliveries" on deliveries;
create policy "Authenticated staff can manage deliveries"
on deliveries for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated staff can read audit logs" on audit_logs;
create policy "Authenticated staff can read audit logs"
on audit_logs for select to authenticated using (true);

drop policy if exists "Authenticated staff can create audit logs" on audit_logs;
create policy "Authenticated staff can create audit logs"
on audit_logs for insert to authenticated with check (user_id = auth.uid());
