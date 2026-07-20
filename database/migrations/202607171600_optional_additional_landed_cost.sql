-- Re-introduces "additional landed cost" as an OPTIONAL advanced field (it was removed
-- entirely in an earlier unit because it had been mandatory). Additive only.
--
-- inventory_batches already has everything needed (allocated_import_cost_bhd,
-- landed_unit_cost_bhd from Phase 11) — reused as-is, no migration needed there. The only
-- gap is on product_variants: there is no denormalized "latest additional cost" field, so
-- the product detail / catalog / stock management / dashboard cost surfaces cannot show it
-- without joining inventory_batches. Adding it here keeps them all reading directly from
-- product_variants, consistent with latest_supplier_unit_cost_inr / latest_exchange_rate_to_bhd.
--
-- NOT NULL DEFAULT 0 (not nullable): this field is optional to the STAFF (they can leave it
-- blank and it means "no extra cost"), but it is never "missing" data the way INR/rate are —
-- getValidBuyingCost() treats a valid buying cost as INR>0 AND rate>0, with this field simply
-- added on top (0 when not entered). See lib/utils/cost-conversion.ts.

alter table product_variants
  add column if not exists latest_additional_landed_cost_bhd numeric(12, 3) not null default 0;
