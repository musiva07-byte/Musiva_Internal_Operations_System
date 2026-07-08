-- DANGER:
-- This script deletes all business data for client handover.
-- Do not run after real client usage starts.
-- Take a Supabase backup/export before running.
-- Run only after confirming there is no real client business data.
--
-- MANUAL CONFIRMATION REQUIRED:
-- Change the confirmation_value below from:
--   TYPE_CLIENT_HANDOVER_CLEANUP_HERE
-- to exactly:
--   I_UNDERSTAND_DELETE_ALL_BUSINESS_DATA
--
-- This script intentionally keeps system tables required for the app:
-- profiles, roles, permissions, role_permissions, settings, auth users,
-- RLS policies, functions, migrations, and schema objects.

begin;

-- ---------------------------------------------------------------------------
-- PREFLIGHT: identify demo/test business records before deletion.
-- Run these SELECTs first if you want to review the target data manually.
-- ---------------------------------------------------------------------------

select 'orders' as table_name, count(*) as matching_rows
from orders
where order_number between 'MSV-10001' and 'MSV-10008'
   or notes ilike '%demo%'
union all
select 'customers', count(*)
from customers
where full_name in ('Fine', 'FINE HOMES', 'Sara Al Khalifa', 'Mariam Ahmed', 'Noora Hassan', 'Fatima Ali')
   or email ilike '%@example.com'
union all
select 'deliveries', count(*)
from deliveries
where customer_name in ('Fine', 'FINE HOMES', 'Sara Al Khalifa', 'Mariam Ahmed', 'Noora Hassan', 'Fatima Ali')
   or delivery_note ilike '%demo%'
union all
select 'products', count(*)
from products
where name in (
  'A line top',
  'Satin Wrap Dress',
  'Pearl Trim Abaya',
  'Soft Rib Boutique Top',
  'Mini Pearl Clutch',
  'Gold Drop Earrings',
  'Tailored Wide Trousers'
)
   or description ilike '%demo%';

-- Product image paths linked to products being deleted.
-- Use this list for Supabase Storage cleanup after the SQL transaction commits.
select path as product_image_path_to_delete
from product_images
where path is not null
order by path;

do $$
declare
  confirmation_value text := 'TYPE_CLIENT_HANDOVER_CLEANUP_HERE';
begin
  if confirmation_value <> 'I_UNDERSTAND_DELETE_ALL_BUSINESS_DATA' then
    raise exception
      'Client handover cleanup not confirmed. Edit confirmation_value before running.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- CLEANUP: delete child records before parent records.
-- Optional tables are guarded with to_regclass so the script can run across
-- slightly different migration states.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.order_status_history') is not null then
    execute 'delete from public.order_status_history';
  end if;

  if to_regclass('public.delivery_status_history') is not null then
    execute 'delete from public.delivery_status_history';
  end if;
end $$;

delete from audit_logs;

delete from payments;
delete from deliveries;
delete from return_items;
delete from returns;
delete from order_items;
delete from orders;
delete from customer_addresses;
delete from customers;

delete from stock_movements;
delete from inventory_batches;
delete from purchase_order_items;
delete from purchase_orders;
delete from expenses;
delete from suppliers;

delete from product_images;
delete from product_variants;
delete from products;

-- Categories are intentionally kept because the standard category list is
-- useful system setup data for product creation. If you have confirmed that
-- categories are demo-only and should also be cleared, run this separately:
-- delete from categories;

-- Exchange rates are intentionally kept. If the database contains test-only
-- exchange rates and the client wants a blank finance setup, review and run:
-- delete from exchange_rates;

-- Reset sequence-backed business numbers so first real records start clean.
do $$
begin
  if to_regclass('public.order_number_seq') is not null then
    execute 'alter sequence public.order_number_seq restart with 10001';
  end if;

  if to_regclass('public.purchase_number_seq') is not null then
    execute 'alter sequence public.purchase_number_seq restart with 10001';
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- POST-CLEANUP STORAGE PLAN
-- ---------------------------------------------------------------------------
-- Delete only product image files returned by the preflight
-- product_image_path_to_delete query.
-- In Supabase Storage, remove those paths from the product image bucket only.
-- Do not delete:
-- - public/moosiva-lux-wear-logo.jpeg
-- - public/moosiva-logo.svg
-- - brand/system logos
-- - any client-confirmed real product images

-- ---------------------------------------------------------------------------
-- VERIFICATION QUERIES: expected 0 for cleaned business tables.
-- ---------------------------------------------------------------------------

select 'products' as table_name, count(*) as row_count from products
union all select 'product_variants', count(*) from product_variants
union all select 'customers', count(*) from customers
union all select 'orders', count(*) from orders
union all select 'order_items', count(*) from order_items
union all select 'deliveries', count(*) from deliveries
union all select 'payments', count(*) from payments
union all select 'stock_movements', count(*) from stock_movements
union all select 'inventory_batches', count(*) from inventory_batches
union all select 'purchase_orders', count(*) from purchase_orders
union all select 'purchase_order_items', count(*) from purchase_order_items
union all select 'expenses', count(*) from expenses
union all select 'suppliers', count(*) from suppliers;

-- Optional history-table verification:
-- select count(*) from order_status_history;
-- select count(*) from delivery_status_history;
-- Run these manually only if the tables exist in the target database.

-- Sequence verification. next_order_value / next_purchase_value should both be 10001.
select last_value + case when is_called then 1 else 0 end as next_order_value
from order_number_seq;

select last_value + case when is_called then 1 else 0 end as next_purchase_value
from purchase_number_seq;
