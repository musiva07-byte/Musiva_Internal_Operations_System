-- Phase 9: Staff, roles, permissions, and business settings

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'staff_role') then
    create type staff_role as enum (
      'owner',
      'manager',
      'sales_staff',
      'inventory_staff',
      'accountant',
      'delivery_coordinator'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'staff_status') then
    create type staff_status as enum ('active', 'inactive');
  end if;
end $$;

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name staff_role not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role staff_role not null default 'sales_staff',
  status staff_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'Moosiva Lux Wear',
  logo_url text,
  logo_path text,
  whatsapp_number text,
  instagram_handle text,
  business_address text,
  invoice_footer text not null default 'Thank you for shopping with Moosiva Lux Wear.',
  return_policy_text text not null default 'Exchange is subject to boutique policy and item condition.',
  default_delivery_charge numeric(12, 3) not null default 0 check (default_delivery_charge >= 0),
  currency text not null default 'BHD',
  low_stock_default_quantity integer not null default 3 check (low_stock_default_quantity >= 0),
  receipt_theme text not null default 'premium_light',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists roles_set_updated_at on roles;
create trigger roles_set_updated_at
before update on roles
for each row execute function set_updated_at();

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
before update on profiles
for each row execute function set_updated_at();

drop trigger if exists settings_set_updated_at on settings;
create trigger settings_set_updated_at
before update on settings
for each row execute function set_updated_at();

create unique index if not exists idx_settings_singleton on settings((true));
create index if not exists idx_profiles_email on profiles(email);
create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_profiles_status on profiles(status);
create index if not exists idx_role_permissions_role on role_permissions(role_id);
create index if not exists idx_role_permissions_permission on role_permissions(permission_id);

alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table profiles enable row level security;
alter table settings enable row level security;

drop policy if exists "Authenticated staff can read roles" on roles;
create policy "Authenticated staff can read roles"
on roles for select to authenticated using (true);

drop policy if exists "Authenticated staff can read permissions" on permissions;
create policy "Authenticated staff can read permissions"
on permissions for select to authenticated using (true);

drop policy if exists "Authenticated staff can read role permissions" on role_permissions;
create policy "Authenticated staff can read role permissions"
on role_permissions for select to authenticated using (true);

drop policy if exists "Authenticated staff can read profiles" on profiles;
create policy "Authenticated staff can read profiles"
on profiles for select to authenticated using (true);

drop policy if exists "Users can update own profile contact fields" on profiles;
create policy "Users can update own profile contact fields"
on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Authenticated staff can read settings" on settings;
create policy "Authenticated staff can read settings"
on settings for select to authenticated using (true);

drop policy if exists "Authenticated staff can update settings" on settings;
create policy "Authenticated staff can update settings"
on settings for update to authenticated using (true) with check (true);

insert into roles (name, description)
values
  ('owner', 'Full access to all system areas.'),
  ('manager', 'Manage operations except system-critical owner-only changes.'),
  ('sales_staff', 'Create orders, customers, print invoices, and update order status.'),
  ('inventory_staff', 'Manage products, stock, suppliers, and purchases.'),
  ('accountant', 'View finance, sales, expenses, and payment reports.'),
  ('delivery_coordinator', 'Manage delivery queue and delivery labels.')
on conflict (name) do nothing;

insert into permissions (permission_key, description)
values
  ('manage_products', 'Create and update products and variants.'),
  ('adjust_inventory', 'Add stock and perform stock adjustments.'),
  ('manage_orders', 'Create and update orders.'),
  ('manage_customers', 'Create and update customers.'),
  ('manage_deliveries', 'Update deliveries and print labels.'),
  ('process_returns', 'Process returns and exchanges.'),
  ('manage_suppliers', 'Create and update suppliers.'),
  ('manage_purchases', 'Create and receive purchases.'),
  ('manage_expenses', 'Create and view expenses.'),
  ('view_reports', 'View reports.'),
  ('manage_staff', 'Create and manage staff users.'),
  ('update_settings', 'Update business settings.')
on conflict (permission_key) do nothing;

insert into settings (business_name)
select 'Moosiva Lux Wear'
where not exists (select 1 from settings);
