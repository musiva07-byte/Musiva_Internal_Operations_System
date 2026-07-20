import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ORDER_STATUSES } from "@/lib/constants";
import { getValidBuyingCost, calcEstimatedMargin } from "@/lib/utils/cost-conversion";
import type {
  CustomerRow,
  ExpenseRow,
  OrderItemRow,
  OrderRow,
  ProductVariantRow,
  StockMovementRow,
} from "@/types/database";

export type ReportPreset = "today" | "yesterday" | "this_week" | "this_month" | "last_month";

export type ReportRange = {
  preset: ReportPreset;
  label: string;
  startIso: string;
  endIso: string;
  startDate: string;
  endDate: string;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getReportRange(preset: string | undefined): ReportRange {
  const selected = ["today", "yesterday", "this_week", "this_month", "last_month"].includes(preset ?? "")
    ? (preset as ReportPreset)
    : "this_month";
  const now = new Date();
  let start = startOfDay(now);
  let end = addDays(start, 1);
  let label = "This Month";

  if (selected === "today") {
    label = "Today";
  }

  if (selected === "yesterday") {
    start = addDays(start, -1);
    end = addDays(start, 1);
    label = "Yesterday";
  }

  if (selected === "this_week") {
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start = addDays(start, mondayOffset);
    end = addDays(start, 7);
    label = "This Week";
  }

  if (selected === "this_month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    label = "This Month";
  }

  if (selected === "last_month") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 1);
    label = "Last Month";
  }

  return {
    preset: selected,
    label,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startDate: dateInputValue(start),
    endDate: dateInputValue(addDays(end, -1)),
  };
}

function groupSum<T extends Record<string, unknown>>(rows: T[], key: keyof T, amountKey: keyof T) {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const groupKey = String(row[key] ?? "unknown");
    const amount = Number(row[amountKey] ?? 0);
    map.set(groupKey, (map.get(groupKey) ?? 0) + amount);
  });
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export async function getSalesReport(range: ReportRange) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { revenue: 0, orderCount: 0, averageOrderValue: 0, discounts: 0, deliveryCharges: 0, bySource: [], byPayment: [], byStatus: [] };
  }

  const { data } = await supabase
    .from("orders")
    .select("grand_total, discount_total, delivery_charge, order_source, payment_method, order_status")
    .neq("order_status", ORDER_STATUSES.cancelled)
    .gte("created_at", range.startIso)
    .lt("created_at", range.endIso)
    .order("created_at", { ascending: false });

  const orders = data ?? [];
  const revenue = orders.reduce((sum, order) => sum + Number(order.grand_total), 0);
  const discounts = orders.reduce((sum, order) => sum + Number(order.discount_total), 0);
  const deliveryCharges = orders.reduce((sum, order) => sum + Number(order.delivery_charge), 0);

  return {
    revenue,
    orderCount: orders.length,
    averageOrderValue: orders.length ? revenue / orders.length : 0,
    discounts,
    deliveryCharges,
    bySource: groupSum(orders as unknown as Record<string, unknown>[], "order_source", "grand_total"),
    byPayment: groupSum(orders as unknown as Record<string, unknown>[], "payment_method", "grand_total"),
    byStatus: groupSum(orders as unknown as Record<string, unknown>[], "order_status", "grand_total"),
  };
}

export async function getInventoryReport() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { totalUnits: 0, lowStock: 0, outOfStock: 0, stockValue: 0, variants: [], recentMovements: [] };
  }

  const [{ data: variants }, { data: movements }] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, variant_sku, color, size, cost_price, selling_price, stock_quantity, minimum_stock, products(name, sku)")
      .neq("status", "archived")
      .order("stock_quantity", { ascending: true })
      .limit(500),
    supabase
      .from("stock_movements")
      .select("id, product_variant_id, movement_type, quantity, previous_quantity, new_quantity, reference_type, reference_id, note, created_by, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const variantRows = (variants ?? []) as unknown as Array<ProductVariantRow & { products?: { name: string; sku: string } | null }>;

  return {
    totalUnits: variantRows.reduce((sum, variant) => sum + variant.stock_quantity, 0),
    lowStock: variantRows.filter((variant) => variant.stock_quantity > 0 && variant.stock_quantity <= variant.minimum_stock).length,
    outOfStock: variantRows.filter((variant) => variant.stock_quantity === 0).length,
    stockValue: variantRows.reduce((sum, variant) => sum + variant.stock_quantity * Number(variant.cost_price), 0),
    variants: variantRows.map((variant) => ({
      ...variant,
      product_name: variant.products?.name ?? "Product",
      product_sku: variant.products?.sku ?? "",
    })),
    recentMovements: (movements ?? []) as StockMovementRow[],
  };
}

export type ProductCostReportRow = {
  productId: string;
  productName: string;
  categoryName: string | null;
  totalStock: number;
  validCostCount: number;
  missingCostCount: number;
  totalBuyingValueInr: number;
  /** Sum of finalUnitCostBhd × stock_quantity (converted + optional additional landed cost). */
  totalFinalCostBhd: number;
  estimatedSellingValueBhd: number;
  estimatedGrossProfitBhd: number;
  estimatedMarginPercent: number | null;
};

type CostReportVariantRow = {
  product_id: string;
  stock_quantity: number;
  latest_supplier_unit_cost_inr: number | null;
  latest_exchange_rate_to_bhd: number | null;
  latest_additional_landed_cost_bhd: number | null;
  regular_selling_price_bhd: number | null;
  selling_price: number;
  status: string;
  products?: { name: string; categories?: { name: string } | null } | null;
};

/**
 * Owner/manager/accountant-only report: one row per product, aggregated the same way as
 * the dashboard/product-detail cost sections (see getValidBuyingCost's doc comment) — only
 * variants with a valid INR + exchange rate contribute to totals, missing ones are counted
 * separately and never assumed to be 0.
 */
export async function getProductCostReport(): Promise<ProductCostReportRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("product_variants")
    .select(
      "product_id, stock_quantity, latest_supplier_unit_cost_inr, latest_exchange_rate_to_bhd, latest_additional_landed_cost_bhd, regular_selling_price_bhd, selling_price, status, products(name, categories(name))",
    )
    .neq("status", "archived");

  const rows = (data ?? []) as unknown as CostReportVariantRow[];
  const byProduct = new Map<string, ProductCostReportRow>();

  for (const row of rows) {
    const existing = byProduct.get(row.product_id) ?? {
      productId: row.product_id,
      productName: row.products?.name ?? "Unknown product",
      categoryName: row.products?.categories?.name ?? null,
      totalStock: 0,
      validCostCount: 0,
      missingCostCount: 0,
      totalBuyingValueInr: 0,
      totalFinalCostBhd: 0,
      estimatedSellingValueBhd: 0,
      estimatedGrossProfitBhd: 0,
      estimatedMarginPercent: null,
    };

    existing.totalStock += row.stock_quantity;
    const cost = getValidBuyingCost(row);
    if (cost) {
      existing.validCostCount += 1;
      const sellingBhd = Number(row.regular_selling_price_bhd ?? row.selling_price);
      existing.totalBuyingValueInr += cost.buyingPriceInr * row.stock_quantity;
      existing.totalFinalCostBhd += cost.finalUnitCostBhd * row.stock_quantity;
      existing.estimatedSellingValueBhd += sellingBhd * row.stock_quantity;
    } else {
      existing.missingCostCount += 1;
    }

    byProduct.set(row.product_id, existing);
  }

  return [...byProduct.values()].map((product) => {
    const estimatedGrossProfitBhd = product.estimatedSellingValueBhd - product.totalFinalCostBhd;
    return {
      ...product,
      estimatedGrossProfitBhd,
      estimatedMarginPercent:
        product.validCostCount > 0
          ? calcEstimatedMargin(product.estimatedSellingValueBhd, product.totalFinalCostBhd)
          : null,
    };
  });
}

export async function getCustomerReport(range: ReportRange) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { newCustomers: 0, repeatCustomers: 0, topCustomers: [] };
  }

  const [{ data: customers }, { data: orders }] = await Promise.all([
    supabase.from("customers").select("id").gte("created_at", range.startIso).lt("created_at", range.endIso),
    supabase
      .from("orders")
      .select("id, customer_id, grand_total, created_at")
      .neq("order_status", ORDER_STATUSES.cancelled)
      .gte("created_at", range.startIso)   // respect the selected date range
      .lt("created_at", range.endIso)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const orderRows = (orders ?? []) as OrderRow[];
  const customerIds = [...new Set(orderRows.map((order) => order.customer_id))];
  const { data: customerRows } = customerIds.length
    ? await supabase.from("customers").select("id, full_name, mobile").in("id", customerIds)
    : { data: [] as CustomerRow[] };

  const topCustomers = (customerRows ?? [])
    .map((customer) => {
      const customerOrders = orderRows.filter((order) => order.customer_id === customer.id);
      return {
        id: customer.id,
        full_name: customer.full_name,
        mobile: customer.mobile,
        order_count: customerOrders.length,
        total_spending: customerOrders.reduce((sum, order) => sum + Number(order.grand_total), 0),
      };
    })
    .filter((customer) => customer.order_count > 0)
    .sort((a, b) => b.total_spending - a.total_spending)
    .slice(0, 10);

  return {
    newCustomers: customers?.length ?? 0,
    repeatCustomers: topCustomers.filter((customer) => customer.order_count > 1).length,
    topCustomers,
  };
}

export async function getFinanceReport(range: ReportRange) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { revenue: 0, discounts: 0, deliveryCharges: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0 };
  }

  const [{ data: orders }, { data: expenses }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, grand_total, discount_total, delivery_charge")
      .neq("order_status", ORDER_STATUSES.cancelled)
      .gte("created_at", range.startIso)
      .lt("created_at", range.endIso),
    supabase
      .from("expenses")
      .select("amount")
      .gte("expense_date", range.startDate)
      .lte("expense_date", range.endDate),
  ]);

  const orderRows = (orders ?? []) as Pick<OrderRow, "id" | "grand_total" | "discount_total" | "delivery_charge">[];
  const orderIds = orderRows.map((order) => order.id);
  const { data: items } = orderIds.length
    ? await supabase.from("order_items").select("product_variant_id, quantity").in("order_id", orderIds)
    : { data: [] as OrderItemRow[] };
  const variantIds = [...new Set((items ?? []).map((item) => item.product_variant_id))];
  const { data: variants } = variantIds.length
    ? await supabase.from("product_variants").select("id, cost_price").in("id", variantIds)
    : { data: [] as ProductVariantRow[] };

  const revenue = orderRows.reduce((sum, order) => sum + Number(order.grand_total), 0);
  const discounts = orderRows.reduce((sum, order) => sum + Number(order.discount_total), 0);
  const deliveryCharges = orderRows.reduce((sum, order) => sum + Number(order.delivery_charge), 0);
  const cogs = (items ?? []).reduce((sum, item) => {
    const variant = (variants ?? []).find((row) => row.id === item.product_variant_id);
    return sum + item.quantity * Number(variant?.cost_price ?? 0);
  }, 0);
  const expenseTotal = ((expenses ?? []) as ExpenseRow[]).reduce((sum, expense) => sum + Number(expense.amount), 0);
  const grossProfit = revenue - cogs;

  return {
    revenue,
    discounts,
    deliveryCharges,
    cogs,
    grossProfit,
    expenses: expenseTotal,
    netProfit: grossProfit - expenseTotal,
  };
}
