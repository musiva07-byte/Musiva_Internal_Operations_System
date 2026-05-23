-- Phase 6: Returns and Exchanges

do $$
begin
  if not exists (select 1 from pg_type where typname = 'return_type') then
    create type return_type as enum ('return', 'exchange');
  end if;

  if not exists (select 1 from pg_type where typname = 'return_reason') then
    create type return_reason as enum (
      'size_issue',
      'color_issue',
      'damaged_item',
      'wrong_item_sent',
      'customer_changed_mind',
      'delivery_failed',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'return_condition') then
    create type return_condition as enum ('sellable', 'damaged', 'needs_review');
  end if;

  if not exists (select 1 from pg_type where typname = 'return_status') then
    create type return_status as enum ('pending', 'approved', 'completed', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'return_item_action') then
    create type return_item_action as enum (
      'add_back_to_stock',
      'mark_damaged',
      'exchange',
      'refund_only',
      'no_stock_change'
    );
  end if;
end $$;

create table if not exists returns (
  id uuid primary key default gen_random_uuid(),
  original_order_id uuid not null references orders(id) on delete restrict,
  customer_id uuid not null references customers(id) on delete restrict,
  return_type return_type not null,
  reason return_reason not null,
  condition return_condition not null,
  refund_amount numeric(12, 3) not null default 0 check (refund_amount >= 0),
  exchange_order_id uuid references orders(id) on delete set null,
  status return_status not null default 'completed',
  staff_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references returns(id) on delete cascade,
  product_variant_id uuid not null references product_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  action return_item_action not null,
  created_at timestamptz not null default now()
);

drop trigger if exists returns_set_updated_at on returns;
create trigger returns_set_updated_at
before update on returns
for each row execute function set_updated_at();

create index if not exists idx_returns_original_order on returns(original_order_id);
create index if not exists idx_returns_customer on returns(customer_id);
create index if not exists idx_returns_status on returns(status);
create index if not exists idx_returns_created_at on returns(created_at);
create index if not exists idx_return_items_return on return_items(return_id);
create index if not exists idx_return_items_variant on return_items(product_variant_id);

alter table returns enable row level security;
alter table return_items enable row level security;

drop policy if exists "Authenticated staff can read returns" on returns;
create policy "Authenticated staff can read returns"
on returns for select to authenticated using (true);

drop policy if exists "Authenticated staff can manage returns" on returns;
create policy "Authenticated staff can manage returns"
on returns for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated staff can read return items" on return_items;
create policy "Authenticated staff can read return items"
on return_items for select to authenticated using (true);

drop policy if exists "Authenticated staff can manage return items" on return_items;
create policy "Authenticated staff can manage return items"
on return_items for all to authenticated using (true) with check (true);
