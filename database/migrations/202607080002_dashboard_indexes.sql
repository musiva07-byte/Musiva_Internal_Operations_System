-- Indexes that improve dashboard query performance.
-- order_items.created_at: used by the 30-day best-seller aggregation.
-- product_variants.status: used to exclude archived variants from stock counts.

create index if not exists idx_order_items_created_at
  on order_items(created_at);

create index if not exists idx_product_variants_status
  on product_variants(status);
