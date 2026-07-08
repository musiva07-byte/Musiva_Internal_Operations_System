-- ============================================================
-- Enforce one image per product at the database level.
-- The service already enforces this in code; this index
-- provides a hard guarantee and fast single-image lookups.
-- ============================================================

create unique index if not exists uniq_product_images_product_id
  on product_images(product_id);
