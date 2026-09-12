"use server";

import { listOrderableVariants } from "@/lib/services/order.service";
import type { OrderableVariantItem } from "@/types/app";

/**
 * Live product search for New Sale's Items step — searches the full active catalog
 * server-side (see listOrderableVariants' doc comment for why this can't be a client-side
 * filter over a fixed initial list).
 */
export async function searchOrderableVariantsAction(
  query: string,
  includeOutOfStock = false,
): Promise<OrderableVariantItem[]> {
  return listOrderableVariants({ q: query, includeOutOfStock });
}
