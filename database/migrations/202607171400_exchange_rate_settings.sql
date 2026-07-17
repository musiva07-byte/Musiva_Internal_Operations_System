-- Exchange Rate Settings (Settings → Exchange Rates), owner/manager-managed.
--
-- exchange_rates already exists (202607050001_pricing_purchasing_batches.sql) but has
-- never been wired to any UI or workflow — it currently has zero live consumers. This
-- migration turns it into the backing store for a single "current INR → BHD rate" that
-- the New Product wizard auto-fills, instead of staff retyping a rate on every product.
--
-- Convention for rows managed through this workflow: `rate` = 1 unit of quote_currency
-- expressed in BHD (multiply direction), e.g. quote_currency='INR', rate=0.004520 means
-- 1 INR = 0.004520 BHD. This matches src/lib/utils/cost-conversion.ts's convention
-- exactly (already used for opening-stock buying cost). It is the INVERSE of the
-- purchase module's own manually-entered exchange_rate_to_bhd (INR-per-BHD, divide
-- direction) — the two are independent and never automatically synced; nothing in the
-- purchase flow reads this table.

alter table exchange_rates
  add column if not exists is_active  boolean not null default true,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists exchange_rates_set_updated_at on exchange_rates;
create trigger exchange_rates_set_updated_at
before update on exchange_rates
for each row execute function set_updated_at();

-- Only one active rate per currency pair — set_exchange_rate() below maintains this.
create unique index if not exists idx_exchange_rates_active_pair
  on exchange_rates(base_currency, quote_currency)
  where is_active;

-- Sets a new current rate atomically: deactivate any existing active row for the pair,
-- then insert the new one as active. Owner/manager only.
create or replace function set_exchange_rate(
  p_quote_currency text,
  p_rate           numeric,
  p_effective_date date,
  p_source         text default 'manual'
)
returns exchange_rates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row exchange_rates;
begin
  perform assert_staff_role(
    array['owner'::staff_role, 'manager'::staff_role],
    'Only owner or manager can update the exchange rate.'
  );

  if p_rate is null or p_rate <= 0 then
    raise exception 'Exchange rate must be greater than 0.';
  end if;

  update exchange_rates
  set is_active = false
  where base_currency = 'BHD'
    and quote_currency = p_quote_currency
    and is_active;

  insert into exchange_rates (
    base_currency, quote_currency, rate, rate_date, source, is_manual, is_active,
    created_by, updated_by
  ) values (
    'BHD', p_quote_currency, p_rate, p_effective_date, coalesce(p_source, 'manual'), true, true,
    auth.uid(), auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- Tighten RLS: any authenticated staff can read the current rate (needed to auto-fill
-- the product form); only owner/manager can write. Replaces the Phase 11 placeholder
-- "using (true)" policy for all commands.
drop policy if exists "Authenticated staff can manage exchange rates" on exchange_rates;

drop policy if exists "Role staff can manage exchange rates" on exchange_rates;
create policy "Role staff can manage exchange rates"
on exchange_rates for all to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role]));

-- ── product_variants: denormalized "latest buying cost in INR" ─────────────────
-- latest_landed_cost_bhd / average_landed_cost_bhd already exist and are reused as the
-- BHD buying-cost figures (no import cost is added in this workflow, so landed = converted).
-- These two columns are the only pieces missing: the INR amount and the rate that produced
-- the current BHD figure, so product detail / stock management / dashboard can show
-- "buying price INR" and "exchange rate used" without joining inventory_batches.
alter table product_variants
  add column if not exists latest_supplier_unit_cost_inr numeric(14, 4),
  add column if not exists latest_exchange_rate_to_bhd   numeric(18, 6);
