-- ============================================================
-- Phase: Customer Workflow Redesign
-- Adds: normalized phone fields, customer_addresses, fulfilment_method,
--       delivery_status_history, delivery_charge_rules
--
-- This migration is fully additive. Existing data is preserved.
-- Run the DUPLICATE DETECTION query (Section 0) before applying
-- the unique constraint (Section 1c) in production.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. DUPLICATE DETECTION
--    Run this first. If rows are returned, resolve them before
--    enabling the unique constraint in Section 1c.
-- ─────────────────────────────────────────────────────────────

-- (For review only — this block does NOT modify any data.)
-- SELECT mobile, count(*) AS customer_count,
--        array_agg(id ORDER BY created_at) AS customer_ids
-- FROM customers
-- GROUP BY mobile
-- HAVING count(*) > 1
-- ORDER BY customer_count DESC;

-- ─────────────────────────────────────────────────────────────
-- 1. CUSTOMERS — normalized phone columns
-- ─────────────────────────────────────────────────────────────

-- 1a. Add normalized columns (nullable initially for safe backfill)
alter table customers
  add column if not exists mobile_normalized text,
  add column if not exists whatsapp_normalized text;

-- 1b. SQL-level Bahrain phone normalization function
--     Mirrors the TypeScript normalizeBahrainPhone() utility.
--     Returns "97XXXXXXXX" (11 digits, no +) or NULL for invalid input.
create or replace function normalize_bahrain_phone(input text)
returns text
language plpgsql
immutable
strict
as $$
declare
  stripped text;
  no_plus   text;
  no_00     text;
  local_part text;
begin
  -- Strip whitespace, dashes, parentheses, dots
  stripped := regexp_replace(input, '[\s\-().]', '', 'g');

  -- Remove leading +
  if left(stripped, 1) = '+' then
    no_plus := substr(stripped, 2);
  else
    no_plus := stripped;
  end if;

  -- Remove leading 00
  if left(no_plus, 2) = '00' then
    no_00 := substr(no_plus, 3);
  else
    no_00 := no_plus;
  end if;

  -- Handle "973XXXXXXXX" (country code already present)
  if left(no_00, 3) = '973' then
    local_part := substr(no_00, 4);
    if length(local_part) = 8 and no_00 ~ '^\d+$' then
      return '973' || local_part;
    end if;
    return null;
  end if;

  -- Handle 8-digit local number
  if length(no_00) = 8 and no_00 ~ '^\d+$' then
    return '973' || no_00;
  end if;

  return null;
end;
$$;

-- 1c. Backfill normalized mobile values from existing records
update customers
set
  mobile_normalized   = normalize_bahrain_phone(mobile),
  whatsapp_normalized = normalize_bahrain_phone(whatsapp)
where mobile_normalized is null;

-- 1d. Index for fast mobile search
create index if not exists idx_customers_mobile_normalized
  on customers(mobile_normalized);

create index if not exists idx_customers_whatsapp_normalized
  on customers(whatsapp_normalized);

-- 1e. UNIQUE CONSTRAINT ON mobile_normalized
--     IMPORTANT: Run the duplicate detection query (Section 0) first.
--     If duplicates exist, resolve them before enabling this constraint.
--     To apply: uncomment the two lines below.
-- alter table customers
--   add constraint customers_mobile_normalized_unique unique (mobile_normalized);

-- ─────────────────────────────────────────────────────────────
-- 2. CUSTOMER ADDRESSES TABLE
-- ─────────────────────────────────────────────────────────────

create table if not exists customer_addresses (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references customers(id) on delete cascade,
  label          text not null default 'Home',      -- 'Home', 'Work', 'Other'
  governorate    text,
  area           text,
  block          text,
  road           text,
  building       text,
  flat           text,
  landmark       text,
  delivery_notes text,
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Only one default address per customer (partial unique index)
create unique index if not exists idx_customer_addresses_one_default
  on customer_addresses(customer_id)
  where is_default = true;

create index if not exists idx_customer_addresses_customer
  on customer_addresses(customer_id);

drop trigger if exists customer_addresses_set_updated_at on customer_addresses;
create trigger customer_addresses_set_updated_at
  before update on customer_addresses
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 3. ORDERS — fulfilment_method
-- ─────────────────────────────────────────────────────────────

-- 3a. Create the enum type (idempotent)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'fulfilment_method') then
    create type fulfilment_method as enum (
      'walk_in',
      'customer_pickup',
      'delivery'
    );
  end if;
end $$;

-- 3b. Add column to orders (defaults to walk_in to preserve existing rows)
alter table orders
  add column if not exists fulfilment_method fulfilment_method not null default 'walk_in';

-- Backfill: orders that have a delivery record should be marked as delivery
update orders o
set fulfilment_method = 'delivery'
where fulfilment_method = 'walk_in'
  and exists (
    select 1 from deliveries d where d.order_id = o.id
  );

-- ─────────────────────────────────────────────────────────────
-- 4. DELIVERIES — assignment and failure fields
-- ─────────────────────────────────────────────────────────────

-- Add assignment and failure reason columns
alter table deliveries
  add column if not exists assigned_to_id    uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at       timestamptz,
  add column if not exists failure_reason    text,
  add column if not exists failure_note      text,
  add column if not exists cod_amount        numeric(12, 3),
  add column if not exists cod_collected     boolean not null default false,
  add column if not exists cod_collected_at  timestamptz;

-- ─────────────────────────────────────────────────────────────
-- 5. DELIVERY STATUS HISTORY TABLE
-- ─────────────────────────────────────────────────────────────

create table if not exists delivery_status_history (
  id              uuid primary key default gen_random_uuid(),
  delivery_id     uuid not null references deliveries(id) on delete cascade,
  from_status     delivery_status,          -- null for initial entry
  to_status       delivery_status not null,
  reason          text,
  note            text,
  changed_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_delivery_status_history_delivery
  on delivery_status_history(delivery_id);

create index if not exists idx_delivery_status_history_created_at
  on delivery_status_history(created_at);

-- ─────────────────────────────────────────────────────────────
-- 6. DELIVERY CHARGE RULES TABLE
-- ─────────────────────────────────────────────────────────────

create table if not exists delivery_charge_rules (
  id            uuid primary key default gen_random_uuid(),
  governorate   text,                        -- null = applies to all
  area          text,                        -- null = applies to whole governorate
  charge_bhd    numeric(12, 3) not null default 0,
  is_default    boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Only one default rule allowed
create unique index if not exists idx_delivery_charge_rules_default
  on delivery_charge_rules(is_default)
  where is_default = true;

create index if not exists idx_delivery_charge_rules_governorate
  on delivery_charge_rules(governorate);

drop trigger if exists delivery_charge_rules_set_updated_at on delivery_charge_rules;
create trigger delivery_charge_rules_set_updated_at
  before update on delivery_charge_rules
  for each row execute function set_updated_at();

-- Insert a default rule (BHD 0.000) if no rules exist
insert into delivery_charge_rules (charge_bhd, is_default, notes)
select 0, true, 'Default delivery charge'
where not exists (select 1 from delivery_charge_rules);

-- ─────────────────────────────────────────────────────────────
-- 7. CONTROLLED DELIVERY TRANSITION FUNCTION
--    Validates state machine transitions server-side.
-- ─────────────────────────────────────────────────────────────

create or replace function advance_delivery_status(
  p_delivery_id    uuid,
  p_new_status     delivery_status,
  p_reason         text     default null,
  p_note           text     default null,
  p_collected_amt  numeric  default null
)
returns deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery     deliveries;
  v_old_status   delivery_status;
  v_allowed      delivery_status[];
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into v_delivery
  from deliveries
  where id = p_delivery_id
  for update;

  if not found then
    raise exception 'Delivery not found.';
  end if;

  v_old_status := v_delivery.delivery_status;

  -- State machine: define allowed next states per current state
  v_allowed := case v_old_status
    when 'pending'          then array['packed', 'cancelled']::delivery_status[]
    when 'packed'           then array['ready_for_pickup', 'cancelled']::delivery_status[]
    when 'ready_for_pickup' then array['with_courier', 'out_for_delivery', 'cancelled']::delivery_status[]
    when 'with_courier'     then array['out_for_delivery', 'failed', 'returned', 'cancelled']::delivery_status[]
    when 'out_for_delivery' then array['delivered', 'failed', 'returned']::delivery_status[]
    when 'delivered'        then array[]::delivery_status[]
    when 'failed'           then array['with_courier', 'returned', 'cancelled']::delivery_status[]
    when 'returned'         then array[]::delivery_status[]
    else                         array[]::delivery_status[]
  end;

  if not (p_new_status = any(v_allowed)) then
    raise exception 'Invalid status transition: % → %', v_old_status, p_new_status;
  end if;

  -- Failure/return require a reason
  if p_new_status in ('failed', 'returned') and p_reason is null then
    raise exception 'A reason is required when marking delivery as %.', p_new_status;
  end if;

  -- Update delivery row
  update deliveries
  set
    delivery_status    = p_new_status,
    failure_reason     = case when p_new_status in ('failed', 'returned') then p_reason else failure_reason end,
    failure_note       = case when p_new_status in ('failed', 'returned') then p_note   else failure_note   end,
    cod_collected      = case when p_new_status = 'delivered' and p_collected_amt is not null then true  else cod_collected end,
    cod_collected_at   = case when p_new_status = 'delivered' and p_collected_amt is not null then now() else cod_collected_at end,
    cod_amount         = case when p_new_status = 'delivered' and p_collected_amt is not null then p_collected_amt else cod_amount end,
    updated_at         = now()
  where id = p_delivery_id
  returning * into v_delivery;

  -- Record in history
  insert into delivery_status_history (
    delivery_id, from_status, to_status, reason, note, changed_by
  ) values (
    p_delivery_id, v_old_status, p_new_status, p_reason, p_note, auth.uid()
  );

  -- Sync linked order status
  update orders
  set
    order_status = case p_new_status
      when 'out_for_delivery' then 'out_for_delivery'::order_status
      when 'delivered'        then 'delivered'::order_status
      when 'failed'           then order_status   -- keep order status unchanged
      when 'returned'         then 'returned'::order_status
      else order_status
    end,
    updated_at = now()
  where id = v_delivery.order_id;

  return v_delivery;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 8. FIND OR CREATE CUSTOMER (upsert on normalized mobile)
--    Race-safe via ON CONFLICT.
-- ─────────────────────────────────────────────────────────────

create or replace function find_or_create_customer(
  p_full_name  text,
  p_mobile     text,
  p_whatsapp   text     default null,
  p_email      text     default null
)
returns customers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized  text;
  v_customer    customers;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  v_normalized := normalize_bahrain_phone(p_mobile);

  if v_normalized is null then
    raise exception 'Invalid Bahrain mobile number: %', p_mobile;
  end if;

  -- Try to find existing customer by normalized mobile
  select * into v_customer
  from customers
  where mobile_normalized = v_normalized
  limit 1;

  if found then
    return v_customer;
  end if;

  -- Create new customer
  insert into customers (
    full_name, mobile, mobile_normalized,
    whatsapp, whatsapp_normalized, email
  ) values (
    p_full_name,
    p_mobile,
    v_normalized,
    p_whatsapp,
    normalize_bahrain_phone(p_whatsapp),
    p_email
  )
  returning * into v_customer;

  return v_customer;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 9. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────

alter table customer_addresses     enable row level security;
alter table delivery_status_history enable row level security;
alter table delivery_charge_rules   enable row level security;

-- customer_addresses: all authenticated staff can read; sales/managers can write
drop policy if exists "Authenticated staff can read customer addresses" on customer_addresses;
create policy "Authenticated staff can read customer addresses"
  on customer_addresses for select to authenticated using (true);

drop policy if exists "Authenticated staff can manage customer addresses" on customer_addresses;
create policy "Authenticated staff can manage customer addresses"
  on customer_addresses for all to authenticated using (true) with check (true);

-- delivery_status_history: read-only for authenticated staff
drop policy if exists "Authenticated staff can read delivery history" on delivery_status_history;
create policy "Authenticated staff can read delivery history"
  on delivery_status_history for select to authenticated using (true);

drop policy if exists "Service role can insert delivery history" on delivery_status_history;
create policy "Service role can insert delivery history"
  on delivery_status_history for insert to authenticated with check (changed_by = auth.uid());

-- delivery_charge_rules: all staff read; owner/manager write (enforced at app layer)
drop policy if exists "Authenticated staff can read delivery charge rules" on delivery_charge_rules;
create policy "Authenticated staff can read delivery charge rules"
  on delivery_charge_rules for select to authenticated using (true);

drop policy if exists "Authenticated staff can manage delivery charge rules" on delivery_charge_rules;
create policy "Authenticated staff can manage delivery charge rules"
  on delivery_charge_rules for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- 10. ADDITIONAL INDEXES
-- ─────────────────────────────────────────────────────────────

create index if not exists idx_orders_fulfilment_method
  on orders(fulfilment_method);

create index if not exists idx_deliveries_assigned_to
  on deliveries(assigned_to_id);

create index if not exists idx_delivery_charge_rules_area
  on delivery_charge_rules(governorate, area);
