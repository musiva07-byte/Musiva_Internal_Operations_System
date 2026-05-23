-- Phase 10 security hardening: replace broad authenticated policies with role-aware RLS.
-- This migration depends on profiles/staff_role from 202605230007_staff_settings.sql.

create or replace function current_staff_role()
returns staff_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from profiles
  where id = auth.uid()
    and status = 'active'
  limit 1;
$$;

create or replace function has_staff_role(allowed_roles staff_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_staff_role() = any(allowed_roles), false);
$$;

create or replace function assert_staff_role(allowed_roles staff_role[], message text default 'You do not have permission to perform this action.')
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not has_staff_role(allowed_roles) then
    raise exception '%', message;
  end if;
end;
$$;

create or replace function add_variant_stock(
  p_variant_id uuid,
  p_quantity integer,
  p_movement_type stock_movement_type,
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
  perform assert_staff_role(
    array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role, 'sales_staff'::staff_role],
    'You do not have permission to add stock.'
  );

  if p_movement_type in ('opening_stock', 'purchase_stock', 'manual_adjustment', 'cancelled_order_restore') then
    perform assert_staff_role(
      array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role],
      'Only inventory staff, managers, or owners can add inventory stock.'
    );
  end if;

  if p_movement_type not in ('opening_stock', 'purchase_stock', 'return_added', 'manual_adjustment', 'cancelled_order_restore') then
    raise exception 'This stock movement type cannot increase stock.';
  end if;

  if p_quantity <= 0 then
    raise exception 'Stock entry quantity must be greater than zero.';
  end if;

  select stock_quantity
    into v_previous_quantity
  from product_variants
  where id = p_variant_id
  for update;

  if not found then
    raise exception 'Product variant was not found.';
  end if;

  v_new_quantity := v_previous_quantity + p_quantity;

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
    p_movement_type,
    p_quantity,
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

create or replace function adjust_variant_stock(
  p_variant_id uuid,
  p_new_quantity integer,
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
  v_delta integer;
  v_movement stock_movements;
begin
  perform assert_staff_role(
    array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role],
    'Only inventory staff, managers, or owners can adjust stock.'
  );

  if p_new_quantity < 0 then
    raise exception 'New stock quantity cannot be negative.';
  end if;

  select stock_quantity
    into v_previous_quantity
  from product_variants
  where id = p_variant_id
  for update;

  if not found then
    raise exception 'Product variant was not found.';
  end if;

  v_delta := p_new_quantity - v_previous_quantity;

  if v_delta = 0 then
    raise exception 'New stock quantity must be different from the current quantity.';
  end if;

  update product_variants
  set stock_quantity = p_new_quantity
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
    'manual_adjustment',
    v_delta,
    v_previous_quantity,
    p_new_quantity,
    p_reference_type,
    p_reference_id,
    p_note,
    auth.uid()
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

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
  perform assert_staff_role(
    array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role],
    'Only sales staff, managers, or owners can deduct stock for sales.'
  );

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
  perform assert_staff_role(
    array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role],
    'Only inventory staff, managers, or owners can receive purchases.'
  );

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

drop policy if exists "Authenticated staff can manage categories" on categories;
drop policy if exists "Role staff can manage categories" on categories;
create policy "Role staff can manage categories"
on categories for all to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role]));

drop policy if exists "Authenticated staff can manage products" on products;
drop policy if exists "Role staff can manage products" on products;
create policy "Role staff can manage products"
on products for all to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role]));

drop policy if exists "Authenticated staff can manage product variants" on product_variants;
drop policy if exists "Role staff can manage product variants" on product_variants;
create policy "Role staff can manage product variants"
on product_variants for all to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role]));

drop policy if exists "Authenticated staff can manage product images" on product_images;
drop policy if exists "Role staff can manage product images" on product_images;
create policy "Role staff can manage product images"
on product_images for all to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role]));

drop policy if exists "Authenticated staff can read stock movements" on stock_movements;
drop policy if exists "Role staff can read stock movements" on stock_movements;
create policy "Role staff can read stock movements"
on stock_movements for select to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role, 'accountant'::staff_role]));

drop policy if exists "Authenticated staff can insert stock movements through services" on stock_movements;
drop policy if exists "Role staff can insert own stock movements" on stock_movements;
create policy "Role staff can insert own stock movements"
on stock_movements for insert to authenticated
with check (
  created_by = auth.uid()
  and has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role, 'sales_staff'::staff_role])
);

drop policy if exists "Authenticated staff can read payments" on payments;
drop policy if exists "Role staff can read payments" on payments;
create policy "Role staff can read payments"
on payments for select to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'accountant'::staff_role, 'sales_staff'::staff_role]));

drop policy if exists "Authenticated staff can manage customers" on customers;
drop policy if exists "Role staff can manage customers" on customers;
create policy "Role staff can manage customers"
on customers for all to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role]));

drop policy if exists "Authenticated staff can manage orders" on orders;
drop policy if exists "Role staff can manage orders" on orders;
create policy "Role staff can manage orders"
on orders for all to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role]));

drop policy if exists "Authenticated staff can manage order items" on order_items;
drop policy if exists "Role staff can manage order items" on order_items;
create policy "Role staff can manage order items"
on order_items for all to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role]));

drop policy if exists "Authenticated staff can manage payments" on payments;
drop policy if exists "Role staff can manage payments" on payments;
create policy "Role staff can manage payments"
on payments for all to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'accountant'::staff_role, 'sales_staff'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'accountant'::staff_role, 'sales_staff'::staff_role]));

drop policy if exists "Authenticated staff can manage deliveries" on deliveries;
drop policy if exists "Role staff can manage deliveries" on deliveries;
create policy "Role staff can manage deliveries"
on deliveries for all to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'delivery_coordinator'::staff_role, 'sales_staff'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'delivery_coordinator'::staff_role, 'sales_staff'::staff_role]));

drop policy if exists "Authenticated staff can read audit logs" on audit_logs;
drop policy if exists "Role staff can read audit logs" on audit_logs;
create policy "Role staff can read audit logs"
on audit_logs for select to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role]));

drop policy if exists "Authenticated staff can read returns" on returns;
drop policy if exists "Role staff can read returns" on returns;
create policy "Role staff can read returns"
on returns for select to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role, 'inventory_staff'::staff_role, 'accountant'::staff_role]));

drop policy if exists "Authenticated staff can manage returns" on returns;
drop policy if exists "Role staff can manage returns" on returns;
create policy "Role staff can manage returns"
on returns for all to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role, 'inventory_staff'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role, 'inventory_staff'::staff_role]));

drop policy if exists "Authenticated staff can manage return items" on return_items;
drop policy if exists "Role staff can manage return items" on return_items;
create policy "Role staff can manage return items"
on return_items for all to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role, 'inventory_staff'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role, 'inventory_staff'::staff_role]));

drop policy if exists "Authenticated staff can read suppliers" on suppliers;
drop policy if exists "Role staff can read suppliers" on suppliers;
create policy "Role staff can read suppliers"
on suppliers for select to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role, 'accountant'::staff_role]));

drop policy if exists "Authenticated staff can manage suppliers" on suppliers;
drop policy if exists "Role staff can manage suppliers" on suppliers;
create policy "Role staff can manage suppliers"
on suppliers for all to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role]));

drop policy if exists "Authenticated staff can read purchase orders" on purchase_orders;
drop policy if exists "Role staff can read purchase orders" on purchase_orders;
create policy "Role staff can read purchase orders"
on purchase_orders for select to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role, 'accountant'::staff_role]));

drop policy if exists "Authenticated staff can manage purchase orders" on purchase_orders;
drop policy if exists "Role staff can manage purchase orders" on purchase_orders;
create policy "Role staff can manage purchase orders"
on purchase_orders for all to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role]));

drop policy if exists "Authenticated staff can read purchase order items" on purchase_order_items;
drop policy if exists "Role staff can read purchase order items" on purchase_order_items;
create policy "Role staff can read purchase order items"
on purchase_order_items for select to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role, 'accountant'::staff_role]));

drop policy if exists "Authenticated staff can manage purchase order items" on purchase_order_items;
drop policy if exists "Role staff can manage purchase order items" on purchase_order_items;
create policy "Role staff can manage purchase order items"
on purchase_order_items for all to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'inventory_staff'::staff_role]));

drop policy if exists "Authenticated staff can read expenses" on expenses;
drop policy if exists "Role staff can read expenses" on expenses;
create policy "Role staff can read expenses"
on expenses for select to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'accountant'::staff_role]));

drop policy if exists "Authenticated staff can manage expenses" on expenses;
drop policy if exists "Role staff can manage expenses" on expenses;
create policy "Role staff can manage expenses"
on expenses for all to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'accountant'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'accountant'::staff_role]));

drop policy if exists "Authenticated staff can read profiles" on profiles;
drop policy if exists "Role staff can read profiles" on profiles;
create policy "Role staff can read profiles"
on profiles for select to authenticated
using (
  id = auth.uid()
  or has_staff_role(array['owner'::staff_role, 'manager'::staff_role])
);

drop policy if exists "Users can update own profile contact fields" on profiles;
drop policy if exists "Users can update own profile row" on profiles;
drop policy if exists "Owners can manage profiles" on profiles;
create policy "Owners can manage profiles"
on profiles for all to authenticated
using (has_staff_role(array['owner'::staff_role]))
with check (has_staff_role(array['owner'::staff_role]));

drop policy if exists "Authenticated staff can update settings" on settings;
drop policy if exists "Role staff can update settings" on settings;
create policy "Role staff can update settings"
on settings for update to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role]));
