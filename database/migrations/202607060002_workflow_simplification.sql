-- ============================================================
-- Step 1 of 2: Add new enum values
--
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction
-- as queries that reference the new value (PG error 55P04).
-- Apply this file first, then apply 202607060003.
--
-- This file is safe to re-run: IF NOT EXISTS guards every ALTER.
-- ============================================================

-- order_status: simplified workflow values
-- Legacy values (packed, ready_for_pickup, out_for_delivery,
-- delivered) are left in place so existing rows remain valid.
alter type order_status add value if not exists 'in_fulfilment';
alter type order_status add value if not exists 'completed';

-- delivery_status: 'cancelled' was already referenced inside
-- advance_delivery_status() but missing from the enum, causing
-- "invalid input value" at runtime. 'returned_to_store' is the
-- new canonical terminal status; 'returned' stays for old rows.
alter type delivery_status add value if not exists 'cancelled';
alter type delivery_status add value if not exists 'returned_to_store';
