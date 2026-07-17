-- Unit 2F: staff access to website_order_requests.
--
-- The table itself already exists in this shared Supabase project — it was created by
-- the separate ecommerce website project's own migration
-- (moosiva-website/database/migrations/202607171000_create_website_order_requests.sql),
-- applied directly by the business owner. That migration enabled RLS with ZERO policies,
-- intentionally: only the website's service-role key can INSERT a pending request.
--
-- This migration adds the staff side: `to authenticated` SELECT + UPDATE policies, scoped
-- by role via the existing has_staff_role() helper (see 202605230008_role_aware_rls.sql),
-- so the new /admin/website-requests page can use the normal session-bound Supabase client
-- (createSupabaseServerClient) like every other table in this codebase, instead of the
-- service-role key. Staff can view and change status, never INSERT or DELETE a request —
-- those stay ecommerce-website-only. Fine-grained per-transition permission (e.g. only
-- owner/manager may confirm or cancel) is enforced in
-- src/lib/services/website-request.service.ts, the same "RLS coarse, app-level fine"
-- pattern already used for deliveries/orders elsewhere in this codebase.

drop policy if exists "Role staff can view website order requests" on website_order_requests;
create policy "Role staff can view website order requests"
on website_order_requests for select to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role, 'inventory_staff'::staff_role]));

drop policy if exists "Role staff can update website order requests" on website_order_requests;
create policy "Role staff can update website order requests"
on website_order_requests for update to authenticated
using (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role, 'inventory_staff'::staff_role]))
with check (has_staff_role(array['owner'::staff_role, 'manager'::staff_role, 'sales_staff'::staff_role, 'inventory_staff'::staff_role]));
