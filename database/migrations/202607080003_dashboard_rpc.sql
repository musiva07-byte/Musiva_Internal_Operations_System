-- RPC used by the dashboard to count stock alerts in a single query without
-- fetching all variant rows for JS-side filtering.
-- Returns one row: low_stock_count and out_of_stock_count.

create or replace function get_stock_alert_counts()
returns table(low_stock_count bigint, out_of_stock_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (
      where stock_quantity > 0
        and stock_quantity <= minimum_stock
        and status != 'archived'
    ) as low_stock_count,
    count(*) filter (
      where stock_quantity = 0
        and status != 'archived'
    ) as out_of_stock_count
  from product_variants;
$$;

-- Allow authenticated users to call this function via RLS.
grant execute on function get_stock_alert_counts() to authenticated;
