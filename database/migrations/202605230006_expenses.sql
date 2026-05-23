-- Phase 8: Expenses

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'expense_category') then
    create type expense_category as enum (
      'product_purchase',
      'packaging',
      'delivery',
      'marketing',
      'rent',
      'staff_salary',
      'utilities',
      'software',
      'miscellaneous'
    );
  end if;
end $$;

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category expense_category not null,
  amount numeric(12, 3) not null check (amount >= 0),
  expense_date date not null default current_date,
  payment_method payment_method not null,
  vendor text,
  notes text,
  attachment_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists expenses_set_updated_at on expenses;
create trigger expenses_set_updated_at
before update on expenses
for each row execute function set_updated_at();

create index if not exists idx_expenses_category on expenses(category);
create index if not exists idx_expenses_expense_date on expenses(expense_date);
create index if not exists idx_expenses_payment_method on expenses(payment_method);
create index if not exists idx_expenses_created_by on expenses(created_by);

alter table expenses enable row level security;

drop policy if exists "Authenticated staff can read expenses" on expenses;
create policy "Authenticated staff can read expenses"
on expenses for select to authenticated using (true);

drop policy if exists "Authenticated staff can manage expenses" on expenses;
create policy "Authenticated staff can manage expenses"
on expenses for all to authenticated using (true) with check (true);
