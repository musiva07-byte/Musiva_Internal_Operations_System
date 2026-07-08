import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaffPermission } from "@/lib/auth/authorization";
import { canManageCustomers } from "@/lib/auth/permissions";
import { customerSchema, type CustomerInput } from "@/lib/validations/customer.schema";
import { normalizeBahrainPhone } from "@/lib/utils/phone";
import { serviceError, serviceSuccess, type ServiceResult } from "./service-result";
import type { CustomerListItem, CustomerSearchResult, CustomerWithAddresses, CustomerWithOrders, PaginatedResult } from "@/types/app";
import type { CustomerAddressRow, CustomerRow, OrderRow } from "@/types/database";

const PAGE_SIZE = 10;

type CustomerFilters = {
  q?: string;
  page?: number;
};

function toPage(value: number | undefined) {
  return Number.isInteger(value) && value && value > 0 ? value : 1;
}

function toCustomerPayload(input: CustomerInput) {
  return {
    full_name: input.fullName,
    mobile: input.mobile,
    mobile_normalized: normalizeBahrainPhone(input.mobile),
    whatsapp: input.whatsapp ?? null,
    whatsapp_normalized: input.whatsapp ? normalizeBahrainPhone(input.whatsapp) : null,
    email: input.email ?? null,
    governorate: input.governorate ?? null,
    area: input.area ?? null,
    block: input.block ?? null,
    road: input.road ?? null,
    building: input.building ?? null,
    flat: input.flat ?? null,
    landmark: input.landmark ?? null,
    delivery_notes: input.deliveryNotes ?? null,
  };
}

export async function listCustomers(
  filters: CustomerFilters = {},
): Promise<PaginatedResult<CustomerListItem>> {
  const supabase = await createSupabaseServerClient();
  const page = toPage(filters.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (!supabase) {
    return { data: [], count: 0, page, pageSize: PAGE_SIZE, pageCount: 0 };
  }

  let query = supabase
    .from("customers")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.q?.trim()) {
    const search = filters.q.trim();
    query = query.or(`full_name.ilike.%${search}%,mobile.ilike.%${search}%,whatsapp.ilike.%${search}%`);
  }

  const { data: customers, count } = await query;
  const rows = customers ?? [];
  const customerIds = rows.map((customer) => customer.id);

  const { data: orders } = customerIds.length
    ? await supabase.from("orders").select("*").in("customer_id", customerIds)
    : { data: [] as OrderRow[] };

  const data = rows.map<CustomerListItem>((customer) => {
    const customerOrders = (orders ?? []).filter((order) => order.customer_id === customer.id);
    const sortedOrders = [...customerOrders].sort((a, b) => b.created_at.localeCompare(a.created_at));

    return {
      ...customer,
      order_count: customerOrders.length,
      total_spending: customerOrders.reduce((sum, order) => sum + Number(order.grand_total), 0),
      last_order_at: sortedOrders[0]?.created_at ?? null,
    };
  });

  return {
    data,
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export async function getCustomer(customerId: string): Promise<CustomerWithOrders | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data: customer } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();

  if (!customer) {
    return null;
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  return {
    ...customer,
    orders: orders ?? [],
  };
}

export async function createCustomer(input: CustomerInput): Promise<ServiceResult<CustomerRow>> {
  const parsed = customerSchema.safeParse(input);

  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await requireStaffPermission(canManageCustomers, "manage customers");
  if (auth.error || !auth.supabase) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const { data, error } = await auth.supabase.from("customers").insert(toCustomerPayload(parsed.data)).select().single();

  if (error || !data) {
    return serviceError("Customer could not be created. Please check the mobile number and try again.");
  }

  revalidatePath("/admin/customers");
  return serviceSuccess(data);
}

export async function updateCustomer(customerId: string, input: CustomerInput): Promise<ServiceResult<CustomerRow>> {
  const parsed = customerSchema.safeParse(input);

  if (!parsed.success) {
    return serviceError(parsed.error.issues[0]?.message);
  }

  const auth = await requireStaffPermission(canManageCustomers, "manage customers");
  if (auth.error || !auth.supabase) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  const { data, error } = await auth.supabase
    .from("customers")
    .update(toCustomerPayload(parsed.data))
    .eq("id", customerId)
    .select()
    .single();

  if (error || !data) {
    return serviceError("Customer could not be updated.");
  }

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
  return serviceSuccess(data);
}

/**
 * Search for a customer by mobile number (normalized).
 * Returns customer + addresses + order stats, or null if not found.
 */
export async function searchCustomerByMobile(mobile: string): Promise<CustomerSearchResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const normalized = normalizeBahrainPhone(mobile);
  if (!normalized) return null;

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("mobile_normalized", normalized)
    .maybeSingle();

  if (!customer) return null;

  const [{ data: addresses }, { data: orders }] = await Promise.all([
    supabase.from("customer_addresses").select("*").eq("customer_id", customer.id).order("is_default", { ascending: false }),
    supabase.from("orders").select("id, grand_total, created_at").eq("customer_id", customer.id),
  ]);

  const orderList = orders ?? [];
  const sortedOrders = [...orderList].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    customer,
    addresses: addresses ?? [],
    order_count: orderList.length,
    last_order_at: sortedOrders[0]?.created_at ?? null,
    total_spending: orderList.reduce((sum, o) => sum + Number(o.grand_total), 0),
  };
}

/**
 * Race-safe find-or-create by normalized mobile.
 * Uses the Postgres function so two simultaneous requests won't create duplicates.
 */
export async function findOrCreateCustomer(
  fullName: string,
  mobile: string,
  whatsapp?: string,
  email?: string,
): Promise<ServiceResult<CustomerRow>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return serviceError("Database connection failed.");

  const { data, error } = await supabase.rpc("find_or_create_customer", {
    p_full_name: fullName,
    p_mobile: mobile,
    p_whatsapp: whatsapp ?? null,
    p_email: email ?? null,
  });

  if (error || !data) {
    return serviceError(error?.message ?? "Customer could not be found or created.");
  }

  revalidatePath("/admin/customers");
  return serviceSuccess(data as CustomerRow);
}

// ─── Customer Addresses ─────────────────────────────────────────────────────

export async function listCustomerAddresses(customerId: string): Promise<CustomerAddressRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("customer_addresses")
    .select("*")
    .eq("customer_id", customerId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  return data ?? [];
}

export type CustomerAddressInput = {
  label?: string;
  governorate?: string;
  area?: string;
  block?: string;
  road?: string;
  building?: string;
  flat?: string;
  landmark?: string;
  delivery_notes?: string;
  is_default?: boolean;
};

export async function createCustomerAddress(
  customerId: string,
  input: CustomerAddressInput,
): Promise<ServiceResult<CustomerAddressRow>> {
  const auth = await requireStaffPermission(canManageCustomers, "manage customers");
  if (auth.error || !auth.supabase) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  // If this is marked default, unset existing defaults first
  if (input.is_default) {
    await auth.supabase
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("customer_id", customerId)
      .eq("is_default", true);
  }

  const { data, error } = await auth.supabase
    .from("customer_addresses")
    .insert({
      customer_id: customerId,
      label: input.label ?? "Home",
      governorate: input.governorate ?? null,
      area: input.area ?? null,
      block: input.block ?? null,
      road: input.road ?? null,
      building: input.building ?? null,
      flat: input.flat ?? null,
      landmark: input.landmark ?? null,
      delivery_notes: input.delivery_notes ?? null,
      is_default: input.is_default ?? false,
    })
    .select()
    .single();

  if (error || !data) {
    return serviceError("Address could not be saved.");
  }

  revalidatePath(`/admin/customers/${customerId}`);
  return serviceSuccess(data);
}

export async function setDefaultAddress(
  customerId: string,
  addressId: string,
): Promise<ServiceResult<CustomerAddressRow>> {
  const auth = await requireStaffPermission(canManageCustomers, "manage customers");
  if (auth.error || !auth.supabase) {
    return serviceError(auth.error ?? "You do not have permission to perform this action.");
  }

  // Clear existing defaults
  await auth.supabase
    .from("customer_addresses")
    .update({ is_default: false })
    .eq("customer_id", customerId);

  const { data, error } = await auth.supabase
    .from("customer_addresses")
    .update({ is_default: true })
    .eq("id", addressId)
    .eq("customer_id", customerId)
    .select()
    .single();

  if (error || !data) {
    return serviceError("Default address could not be updated.");
  }

  revalidatePath(`/admin/customers/${customerId}`);
  return serviceSuccess(data);
}

export async function getCustomerWithAddresses(customerId: string): Promise<CustomerWithAddresses | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: customer } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();
  if (!customer) return null;

  const addresses = await listCustomerAddresses(customerId);
  return { ...customer, addresses };
}
