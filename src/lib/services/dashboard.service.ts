import { subDays } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DELIVERY_STATUSES, ORDER_STATUSES } from "@/lib/constants";
import { getCurrentExchangeRate } from "./exchange-rate.service";
import { calcEstimatedMargin, getValidBuyingCost } from "@/lib/utils/cost-conversion";
import type { OrderRow, PaymentStatus } from "@/types/database";

type CostVariantRow = {
  color: string;
  size: string;
  stock_quantity: number;
  latest_supplier_unit_cost_inr: number | null;
  latest_exchange_rate_to_bhd: number | null;
  regular_selling_price_bhd: number | null;
  selling_price: number;
  products?: { name: string } | null;
};

type OrderRelationRow = OrderRow & {
  customers?: { full_name: string; mobile: string } | null;
};

type ItemWithOrderRow = {
  product_name_snapshot: string;
  quantity: number;
  line_total: number;
  orders: { order_status: string } | null;
};

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Statuses that count as "in the delivery pipeline" for the attention metric.
const ACTIVE_DELIVERY_STATUSES = [
  DELIVERY_STATUSES.pending,
  DELIVERY_STATUSES.packed,
  DELIVERY_STATUSES.readyForPickup,
  DELIVERY_STATUSES.withCourier,
  DELIVERY_STATUSES.outForDelivery,
];

// Order statuses excluded from revenue and best-seller totals.
const EXCLUDED_ORDER_STATUSES = [ORDER_STATUSES.cancelled, ORDER_STATUSES.returned];

// Delivery statuses shown in the delivery-status summary card.
const LOAD_ERROR = "Unable to load data. Please try again or contact the administrator.";

const DELIVERY_SUMMARY_STATUSES = [
  DELIVERY_STATUSES.pending,
  DELIVERY_STATUSES.packed,
  DELIVERY_STATUSES.readyForPickup,
  DELIVERY_STATUSES.withCourier,
  DELIVERY_STATUSES.outForDelivery,
  DELIVERY_STATUSES.delivered,
  DELIVERY_STATUSES.failed,
  DELIVERY_STATUSES.returnedToStore,
];

function emptyDashboard(loadError?: string) {
  return {
    loadError,
    todaySales: 0,
    monthSales: 0,
    ordersToday: 0,
    pendingDeliveries: 0,
    failedDeliveries: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
    recentOrders: [] as OrderRelationRow[],
    bestSellers: [] as { name: string; quantity: number; revenue: number }[],
    salesChart: [] as { label: string; total: number }[],
    paymentSummary: [] as { status: PaymentStatus; count: number }[],
    deliverySummary: [] as { status: string; count: number }[],
    newWebsiteRequests: 0,
    contactedWebsiteRequests: 0,
    latestWebsiteRequestAt: null as string | null,
    latestExchangeRate: null as number | null,
    validBuyingCostCount: 0,
    productsMissingBuyingCost: 0,
    totalStockBuyingValueInr: 0,
    totalStockBuyingValueBhd: 0,
    estimatedSellingValue: 0,
    estimatedGrossProfit: 0,
    estimatedMarginPercent: null as number | null,
    lowMarginVariants: [] as { name: string; margin: number }[],
  };
}

/** DB-side delivery status aggregation — one count query per status, run in parallel. */
async function getDeliverySummary(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>
): Promise<{ status: string; count: number }[]> {
  const results = await Promise.all(
    DELIVERY_SUMMARY_STATUSES.map((status) =>
      supabase
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .eq("delivery_status", status)
        .then(({ count }) => ({ status, count: count ?? 0 }))
    )
  );
  return results.filter((item) => item.count > 0);
}

export async function getDashboardData() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) return emptyDashboard();

  const todayStart = startOfToday();
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const thirtyDaysStart = subDays(todayStart, 30);
  const chartStart = subDays(todayStart, 6);

  const excludedStatusFilter = `(${EXCLUDED_ORDER_STATUSES.join(",")})`;

  const [
    { data: todayOrders, error: todayOrdersError },
    { data: monthOrders, error: monthOrdersError },
    { data: chartOrders, error: chartOrdersError },
    { count: pendingDeliveriesCount, error: pendingDeliveriesError },
    { count: failedDeliveriesCount, error: failedDeliveriesError },
    { data: recentOrders, error: recentOrdersError },
    { data: stockAlerts, error: stockAlertsError },
    { data: recentItems, error: recentItemsError },
    deliverySummary,
  ] = await Promise.all([
    // Today's gross sales (excluding cancelled/returned)
    supabase
      .from("orders")
      .select("grand_total")
      .not("order_status", "in", excludedStatusFilter)
      .gte("created_at", todayStart.toISOString())
      .lt("created_at", tomorrowStart.toISOString()),

    // Month-to-date gross sales and payment breakdown
    supabase
      .from("orders")
      .select("grand_total, payment_status, created_at")
      .not("order_status", "in", excludedStatusFilter)
      .gte("created_at", monthStart.toISOString()),

    // 7-day chart data
    supabase
      .from("orders")
      .select("grand_total, created_at")
      .not("order_status", "in", excludedStatusFilter)
      .gte("created_at", chartStart.toISOString())
      .lt("created_at", tomorrowStart.toISOString()),

    // Pending deliveries count (in pipeline)
    supabase
      .from("deliveries")
      .select("id", { count: "exact", head: true })
      .in("delivery_status", ACTIVE_DELIVERY_STATUSES),

    // Failed deliveries that need re-attempt
    supabase
      .from("deliveries")
      .select("id", { count: "exact", head: true })
      .eq("delivery_status", DELIVERY_STATUSES.failed),

    // Recent orders with customer info
    supabase
      .from("orders")
      .select(
        "id, order_number, order_status, grand_total, created_at, customers(full_name, mobile)"
      )
      .order("created_at", { ascending: false })
      .limit(8),

    // DB-side stock alert aggregation via RPC — avoids fetching all variant rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc("get_stock_alert_counts").single(),

    // Best sellers: join orders!inner to exclude cancelled/returned order items
    supabase
      .from("order_items")
      .select("product_name_snapshot, quantity, line_total, orders!inner(order_status)")
      .neq("orders.order_status", ORDER_STATUSES.cancelled)
      .neq("orders.order_status", ORDER_STATUSES.returned)
      .gte("created_at", thirtyDaysStart.toISOString())
      .limit(500),

    // Delivery status summary — DB-side count per status
    getDeliverySummary(supabase),
  ]);

  if (
    todayOrdersError ||
    monthOrdersError ||
    chartOrdersError ||
    pendingDeliveriesError ||
    failedDeliveriesError ||
    recentOrdersError ||
    stockAlertsError ||
    recentItemsError
  ) {
    return emptyDashboard(LOAD_ERROR);
  }

  // Website requests (from www.moosivabh.com) — kept as its own lenient batch so a problem
  // here (e.g. RLS policies not yet applied) degrades to zero counts instead of failing the
  // whole dashboard.
  const [newWebsiteRequestsRes, contactedWebsiteRequestsRes, latestWebsiteRequestRes] =
    await Promise.all([
      supabase
        .from("website_order_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
      supabase
        .from("website_order_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "contacted"),
      supabase
        .from("website_order_requests")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  // Product Cost Summary (owner/manager/accountant) — its own lenient batch so a problem
  // here degrades to zero/empty values instead of failing the whole dashboard.
  const [currentRate, { data: costVariants }] = await Promise.all([
    getCurrentExchangeRate("INR"),
    supabase
      .from("product_variants")
      .select(
        "color, size, stock_quantity, latest_supplier_unit_cost_inr, latest_exchange_rate_to_bhd, regular_selling_price_bhd, selling_price, products(name)",
      )
      .neq("status", "archived"),
  ]);

  const costRows = (costVariants ?? []) as unknown as CostVariantRow[];
  let validBuyingCostCount = 0;
  let productsMissingBuyingCost = 0;
  let totalStockBuyingValueInr = 0;
  let totalStockBuyingValueBhd = 0;
  let estimatedSellingValue = 0;
  const lowMarginCandidates: { name: string; margin: number }[] = [];

  // Totals are computed only from variants with a valid buying cost (see
  // getValidBuyingCost's doc comment for why latest_landed_cost_bhd /
  // average_landed_cost_bhd are never trusted here) — mixing valid and missing-cost
  // variants into the same total is exactly what produced impossible dashboard figures
  // before this fix.
  for (const row of costRows) {
    const cost = getValidBuyingCost(row);

    if (!cost) {
      if (row.stock_quantity > 0) {
        productsMissingBuyingCost += 1;
      }
      continue;
    }

    validBuyingCostCount += 1;
    const sellingBhd = Number(row.regular_selling_price_bhd ?? row.selling_price);

    totalStockBuyingValueInr += cost.buyingPriceInr * row.stock_quantity;
    totalStockBuyingValueBhd += cost.buyingPriceBhd * row.stock_quantity;
    estimatedSellingValue += sellingBhd * row.stock_quantity;

    if (sellingBhd > 0) {
      const margin = calcEstimatedMargin(sellingBhd, cost.buyingPriceBhd);
      if (margin !== null && margin < 20) {
        lowMarginCandidates.push({
          name: `${row.products?.name ?? "Unknown product"} (${row.color} / ${row.size})`,
          margin,
        });
      }
    }
  }

  const hasAnyValidBuyingCost = validBuyingCostCount > 0;
  const estimatedGrossProfit = hasAnyValidBuyingCost
    ? estimatedSellingValue - totalStockBuyingValueBhd
    : 0;
  const estimatedMarginPercent =
    hasAnyValidBuyingCost && estimatedSellingValue > 0
      ? (estimatedGrossProfit / estimatedSellingValue) * 100
      : null;
  const lowMarginVariants = lowMarginCandidates.sort((a, b) => a.margin - b.margin).slice(0, 5);

  const todayOrderRows = (todayOrders ?? []) as Pick<OrderRow, "grand_total">[];
  const monthOrderRows = (monthOrders ?? []) as Pick<
    OrderRow,
    "grand_total" | "payment_status" | "created_at"
  >[];
  const chartOrderRows = (chartOrders ?? []) as Pick<OrderRow, "grand_total" | "created_at">[];
  const stockAlertCounts = stockAlerts as { low_stock_count: number; out_of_stock_count: number } | null;
  const itemRows = (recentItems ?? []) as unknown as ItemWithOrderRow[];

  // 7-day chart: one bucket per day
  const lastSevenDays = Array.from({ length: 7 }).map((_, index) => {
    const date = subDays(todayStart, 6 - index);
    const key = dayKey(date);
    const total = chartOrderRows
      .filter((order) => dayKey(new Date(order.created_at)) === key)
      .reduce((sum, order) => sum + Number(order.grand_total), 0);
    return {
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      total,
    };
  });

  // Best sellers: aggregate by product name, sorted by units sold
  const bestSellerMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  itemRows.forEach((item) => {
    const key = item.product_name_snapshot;
    const current = bestSellerMap.get(key) ?? { name: key, quantity: 0, revenue: 0 };
    current.quantity += item.quantity;
    current.revenue += Number(item.line_total);
    bestSellerMap.set(key, current);
  });

  // Payment status breakdown (this month, non-cancelled)
  const paymentMap = new Map<PaymentStatus, number>();
  monthOrderRows.forEach((order) => {
    paymentMap.set(
      order.payment_status,
      (paymentMap.get(order.payment_status) ?? 0) + 1
    );
  });

  return {
    loadError: undefined,
    todaySales: todayOrderRows.reduce((sum, o) => sum + Number(o.grand_total), 0),
    monthSales: monthOrderRows.reduce((sum, o) => sum + Number(o.grand_total), 0),
    ordersToday: todayOrderRows.length,
    pendingDeliveries: pendingDeliveriesCount ?? 0,
    failedDeliveries: failedDeliveriesCount ?? 0,
    lowStockProducts: stockAlertCounts?.low_stock_count ?? 0,
    outOfStockProducts: stockAlertCounts?.out_of_stock_count ?? 0,
    recentOrders: (recentOrders ?? []) as unknown as OrderRelationRow[],
    bestSellers: [...bestSellerMap.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5),
    salesChart: lastSevenDays,
    paymentSummary: [...paymentMap.entries()].map(([status, count]) => ({ status, count })),
    deliverySummary,
    newWebsiteRequests: newWebsiteRequestsRes.count ?? 0,
    contactedWebsiteRequests: contactedWebsiteRequestsRes.count ?? 0,
    latestWebsiteRequestAt: latestWebsiteRequestRes.data?.created_at ?? null,
    latestExchangeRate: currentRate?.rate ?? null,
    validBuyingCostCount,
    productsMissingBuyingCost,
    totalStockBuyingValueInr,
    totalStockBuyingValueBhd,
    estimatedSellingValue,
    estimatedGrossProfit,
    estimatedMarginPercent,
    lowMarginVariants,
  };
}
