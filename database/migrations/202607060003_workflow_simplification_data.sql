-- ============================================================
-- Step 2 of 2: Backfill data and replace advance_delivery_status()
--
-- Run AFTER 202607060002 has been applied and committed.
-- The new enum values (in_fulfilment, completed, cancelled,
-- returned_to_store) must already exist before this file runs.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. BACKFILL — remap legacy order statuses to simplified set
-- ─────────────────────────────────────────────────────────────

-- Delivery orders stuck mid-pipeline → in_fulfilment
update orders
set order_status = 'in_fulfilment'
where order_status in ('packed', 'ready_for_pickup', 'out_for_delivery')
  and fulfilment_method = 'delivery';

-- All orders previously marked delivered → completed
update orders
set order_status = 'completed'
where order_status = 'delivered';

-- ─────────────────────────────────────────────────────────────
-- 2. REPLACE advance_delivery_status()
--    Updated state machine includes cancelled + returned_to_store.
--    Order sync writes in_fulfilment / completed / cancelled.
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

  -- ── State machine ──────────────────────────────────────────
  v_allowed := case v_old_status
    when 'pending'
      then array['packed','cancelled']::delivery_status[]
    when 'packed'
      then array['ready_for_pickup','cancelled']::delivery_status[]
    when 'ready_for_pickup'
      then array['with_courier','out_for_delivery','cancelled']::delivery_status[]
    when 'with_courier'
      then array['out_for_delivery','failed','returned_to_store','cancelled']::delivery_status[]
    when 'out_for_delivery'
      then array['delivered','failed','returned_to_store']::delivery_status[]
    when 'delivered'
      then array[]::delivery_status[]
    when 'failed'
      then array['with_courier','returned_to_store','cancelled']::delivery_status[]
    when 'returned_to_store'
      then array[]::delivery_status[]
    when 'returned'
      then array[]::delivery_status[]   -- legacy terminal
    when 'cancelled'
      then array[]::delivery_status[]
    else
      array[]::delivery_status[]
  end;

  if not (p_new_status = any(v_allowed)) then
    raise exception 'Invalid status transition: % → %', v_old_status, p_new_status;
  end if;

  -- ── Reason requirement ─────────────────────────────────────
  if p_new_status in ('failed', 'returned_to_store', 'returned') and p_reason is null then
    raise exception 'A reason is required when marking delivery as %.', p_new_status;
  end if;

  -- ── Update delivery row ────────────────────────────────────
  update deliveries
  set
    delivery_status  = p_new_status,
    failure_reason   = case
                         when p_new_status in ('failed','returned_to_store','returned')
                         then p_reason
                         else failure_reason
                       end,
    failure_note     = case
                         when p_new_status in ('failed','returned_to_store','returned')
                         then p_note
                         else failure_note
                       end,
    cod_collected    = case
                         when p_new_status = 'delivered' and p_collected_amt is not null
                         then true
                         else cod_collected
                       end,
    cod_collected_at = case
                         when p_new_status = 'delivered' and p_collected_amt is not null
                         then now()
                         else cod_collected_at
                       end,
    cod_amount       = case
                         when p_new_status = 'delivered' and p_collected_amt is not null
                         then p_collected_amt
                         else cod_amount
                       end,
    updated_at       = now()
  where id = p_delivery_id
  returning * into v_delivery;

  -- ── History ────────────────────────────────────────────────
  insert into delivery_status_history (
    delivery_id, from_status, to_status, reason, note, changed_by
  ) values (
    p_delivery_id, v_old_status, p_new_status, p_reason, p_note, auth.uid()
  );

  -- ── Sync linked order ──────────────────────────────────────
  -- delivered         → order completed
  -- cancelled         → order cancelled
  -- returned_to_store → order stays in_fulfilment (manager reviews)
  -- failed            → order stays in_fulfilment (retry possible)
  -- returned          → order returned (legacy path)
  -- all other active  → order in_fulfilment
  update orders
  set
    order_status = case p_new_status
      when 'delivered'         then 'completed'::order_status
      when 'cancelled'         then 'cancelled'::order_status
      when 'returned_to_store' then 'in_fulfilment'::order_status
      when 'failed'            then 'in_fulfilment'::order_status
      when 'returned'          then 'returned'::order_status
      else                          'in_fulfilment'::order_status
    end,
    updated_at = now()
  where id = v_delivery.order_id;

  return v_delivery;
end;
$$;
