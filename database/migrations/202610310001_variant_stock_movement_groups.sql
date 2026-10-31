-- Read-only aggregation behind the Stock Management print report's Total Stock and Sold columns.
-- Adds one function. Changes no table, no row, and no existing function.
-- Rollback: drop function if exists get_variant_stock_movement_groups(uuid[]);
--
-- Returns one jsonb array, not rows, because PostgREST caps returned rows and this report can
-- span thousands of variants. Totals are kept per variant, movement type, and whether the order
-- behind the movement was cancelled; classifying them into Total Stock and Sold lives in one
-- place, summarizeVariantStock() in src/lib/utils/stock-history.ts.
--
-- balance_change is new_quantity - previous_quantity, not quantity: a damaged return records a
-- positive quantity with the balance unchanged, and must not count as stock movement.
--
-- Security definer so an order's status can be read for roles that can read stock_movements but
-- not orders; the role check below matches stock_movements' own read policy.

create or replace function get_variant_stock_movement_groups(p_variant_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_groups jsonb;
begin
  perform assert_staff_role(
    array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role, 'accountant'::staff_role],
    'You do not have permission to view stock history.'
  );

  select coalesce(jsonb_agg(grouped), '[]'::jsonb)
    into v_groups
  from (
    select
      m.product_variant_id as variant_id,
      m.movement_type,
      coalesce(o.order_status = 'cancelled', false) as order_cancelled,
      sum(m.new_quantity - m.previous_quantity)::integer as balance_change
    from stock_movements m
    left join orders o
      on m.reference_type in ('order', 'order_item_correction', 'order_item_correction_rollback')
      and o.id = m.reference_id
    where m.product_variant_id = any(p_variant_ids)
    group by m.product_variant_id, m.movement_type, coalesce(o.order_status = 'cancelled', false)
  ) grouped;

  return v_groups;
end;
$$;

revoke all on function get_variant_stock_movement_groups(uuid[]) from public, anon;
grant execute on function get_variant_stock_movement_groups(uuid[]) to authenticated;

-- Without this the API can keep answering "function not found" until its cache next refreshes.
notify pgrst, 'reload schema';
