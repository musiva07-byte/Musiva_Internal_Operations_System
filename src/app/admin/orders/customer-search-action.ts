"use server";

import { searchCustomerByMobile } from "@/lib/services/customer.service";
import type { CustomerSearchResult } from "@/types/app";

export async function searchCustomerAction(mobile: string): Promise<CustomerSearchResult> {
  return searchCustomerByMobile(mobile);
}
