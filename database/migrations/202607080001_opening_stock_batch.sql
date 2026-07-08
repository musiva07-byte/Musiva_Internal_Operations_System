-- Make inventory_batches support opening-stock entries (no purchase order item).
-- Additive migration — no existing data is changed.

-- 1. Allow opening-stock batches that are not linked to a purchase order item.
alter table inventory_batches
  alter column purchase_order_item_id drop not null;

-- 2. Record when the exchange rate was captured and where it came from.
alter table inventory_batches
  add column if not exists exchange_rate_date   date,
  add column if not exists exchange_rate_source text;

-- 3. Distinguish opening-stock batches from purchase-received batches.
alter table inventory_batches
  add column if not exists batch_type text not null default 'purchase'
    check (batch_type in ('purchase', 'opening_stock'));

-- Backfill existing purchase rows so the constraint is satisfied.
update inventory_batches set batch_type = 'purchase' where batch_type is null;

-- Index useful for filtering by batch type in reports.
create index if not exists idx_inventory_batches_batch_type
  on inventory_batches(batch_type);
