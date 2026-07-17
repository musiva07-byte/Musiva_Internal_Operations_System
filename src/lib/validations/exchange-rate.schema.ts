import { z } from "zod";

/**
 * Settings → Exchange Rates (owner/manager only).
 * rate = 1 unit of quoteCurrency expressed in BHD (multiply direction), matching
 * lib/utils/cost-conversion.ts. Example: quoteCurrency "INR", rate 0.004520.
 */
export const exchangeRateSchema = z.object({
  quoteCurrency: z.string().trim().min(1).default("INR"),
  rate: z.coerce.number().positive("Exchange rate must be greater than 0."),
  effectiveDate: z.string().min(1, "Effective date is required."),
  source: z.enum(["manual", "bank", "other"]).default("manual"),
});

export type ExchangeRateInput = z.infer<typeof exchangeRateSchema>;
