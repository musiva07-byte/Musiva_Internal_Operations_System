-- Unit 2G: Convert to Order (website_order_requests -> orders).
--
-- Additive only. Existing website inserts (service role, INSERT-only) are unaffected —
-- these new columns default to null, and the "Role staff can update website order requests"
-- policy (202607171100) already covers UPDATE for the roles that need to set them.

-- New order source so converted orders are distinguishable from manually-entered ones.
alter type order_source add value if not exists 'website_request';

-- Conversion tracking — converted_order_id is the idempotency guard (see
-- convertWebsiteRequestToOrder(): the linking UPDATE is conditioned on this being null,
-- so a concurrent double-click/double-submit can only ever win once).
alter table website_order_requests
  add column if not exists converted_order_id uuid references orders(id) on delete set null,
  add column if not exists converted_at        timestamptz,
  add column if not exists converted_by        uuid references auth.users(id) on delete set null;

create index if not exists idx_website_order_requests_converted_order
  on website_order_requests(converted_order_id);
