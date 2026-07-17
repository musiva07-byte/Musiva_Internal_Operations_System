-- Unit 2F: operations-side staff access to website_order_requests.
--
-- * website_order_requests was created by the separate moosiva-website (public ecommerce)
--   project's own migration, applied directly by the business owner — NOT by this project.
--   That migration enabled RLS with ZERO policies, intentionally: only the website's
--   server-side service-role key can INSERT a row. The service role bypasses RLS entirely,
--   so nothing in this migration can affect the website's insert path.
-- * This migration only adds staff access on the operations-system side: authenticated
--   SELECT + UPDATE policies, scoped by role via the existing has_staff_role() helper
--   (see 202605230008_role_aware_rls.sql / current_staff_role() + profiles.status = 'active'
--   from 202605230007_staff_settings.sql), matching the "role staff can ..." policy style
--   used everywhere else in this codebase. No INSERT policy and no DELETE policy are added
--   for any authenticated role — those stay ecommerce-website-only (service role) so a
--   request row can never be fabricated or destroyed from the operations app.
-- * Rows here are pending WhatsApp leads captured at checkout on www.moosivabh.com, not
--   final orders. Viewing, marking contacted, or confirming/cancelling a request in the
--   operations system never deducts stock and never creates an orders/order_items row —
--   "Convert to Order" is a distinct action to be implemented in a later unit.
-- * website_order_requests carries no buying price, landed cost, supplier cost, average
--   cost, profit, margin, barcode, or SKU column, and this migration does not join to
--   product_variants or any other cost-bearing table — these two policies only ever read
--   and update columns on website_order_requests itself.
-- * RLS here is intentionally coarse (same 4 roles for SELECT and UPDATE). It only gates
--   "can this staff member touch request rows at all" — it cannot express per-transition
--   rules (e.g. only owner/manager may confirm/cancel, only owner may reopen a cancelled
--   request). Those exact transitions are validated server-side in
--   src/lib/services/website-request.service.ts (permissionForTransition /
--   updateWebsiteRequestStatus), the same "RLS coarse, app-level fine" split already used
--   for deliveries/orders elsewhere in this codebase. Do not rely on RLS alone for those
--   business rules.

alter table website_order_requests enable row level security;

drop policy if exists "Role staff can view website order requests" on website_order_requests;
create policy "Role staff can view website order requests"
on website_order_requests for select to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role, 'inventory_staff'::staff_role]));

drop policy if exists "Role staff can update website order requests" on website_order_requests;
create policy "Role staff can update website order requests"
on website_order_requests for update to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role, 'inventory_staff'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role, 'inventory_staff'::staff_role]));
