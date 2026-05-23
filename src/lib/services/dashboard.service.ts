import { subDays } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DELIVERY_STATUSES, ORDER_STATUSES } from "@/lib/constants";
import type { DeliveryRow, OrderItemRow, OrderRow, PaymentStatus, ProductVariantRow } from "@/types/database";

type OrderRelationRow = OrderRow & {
  customers?: { full_name: string; mobile: string } | null;
};

type VariantRelationRow = ProductVariantRow & {
  products?: { name: string; sku: string } | null;
};

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function getDashboardData() {
  const supabase = await createSupabaseServerClient();
  const todayStart = startOfToday();
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const thirtyDaysStart = subDays(todayStart, 30);
  const chartStart = subDays(todayStart, 6);
  const activeDeliveryStatuses = [
    DELIVERY_STATUSES.pending,
    DELIVERY_STATUSES.packed,
    DELIVERY_STATUSES.readyForPickup,
    DELIVERY_STATUSES.withCourier,
    DELIVERY_STATUSES.outForDelivery,
  ];

  if (!supabase) {
    return {
      todaySales: 0,
      monthSales: 0,
      ordersToday: 0,
      pendingDeliveries: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      recentOrders: [],
      bestSellers: [],
      salesChart: [],
      paymentSummary: [],
      deliverySummary: [],
    };
  }

  const [
    { data: todayOrders },
    { data: monthOrders },
    { data: chartOrders },
    { count: pendingDeliveriesCount },
    { data: deliveryStatuses },
    { data: recentOrders },
    { data: variants },
    { data: recentItems },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("grand_total")
      .neq("order_status", ORDER_STATUSES.cancelled)
      .gte("created_at", todayStart.toISOString())
      .lt("created_at", tomorrowStart.toISOString()),
    supabase
      .from("orders")
      .select("grand_total, payment_status, created_at")
      .neq("order_status", ORDER_STATUSES.cancelled)
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("orders")
      .select("grand_total, created_at")
      .neq("order_status", ORDER_STATUSES.cancelled)
      .gte("created_at", chartStart.toISOString())
      .lt("created_at", tomorrowStart.toISOString()),
    supabase
      .from("deliveries")
      .select("id", { count: "exact", head: true })
      .in("delivery_status", activeDeliveryStatuses),
    supabase
      .from("deliveries")
      .select("delivery_status")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("orders")
      .select("id, order_number, order_status, grand_total, created_at, customers(full_name, mobile)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("product_variants")
      .select("stock_quantity, minimum_stock"),
    supabase
      .from("order_items")
      .select("product_name_snapshot, quantity, line_total")
      .gte("created_at", thirtyDaysStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const monthOrderRows = (monthOrders ?? []) as Pick<OrderRow, "grand_total" | "payment_status" | "created_at">[];
  const todayOrderRows = (todayOrders ?? []) as Pick<OrderRow, "grand_total">[];
  const chartOrderRows = (chartOrders ?? []) as Pick<OrderRow, "grand_total" | "created_at">[];
  const variantRows = (variants ?? []) as unknown as VariantRelationRow[];
  const deliveryRows = (deliveryStatuses ?? []) as Pick<DeliveryRow, "delivery_status">[];
  const itemRows = (recentItems ?? []) as OrderItemRow[];

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

  const bestSellerMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  itemRows.forEach((item) => {
    const key = item.product_name_snapshot;
    const current = bestSellerMap.get(key) ?? { name: key, quantity: 0, revenue: 0 };
    current.quantity += item.quantity;
    current.revenue += Number(item.line_total);
    bestSellerMap.set(key, current);
  });

  const paymentMap = new Map<PaymentStatus, number>();
  monthOrderRows.forEach((order) => {
    paymentMap.set(order.payment_status, (paymentMap.get(order.payment_status) ?? 0) + 1);
  });

  const deliveryMap = new Map<string, number>();
  deliveryRows.forEach((delivery) => {
    deliveryMap.set(delivery.delivery_status, (deliveryMap.get(delivery.delivery_status) ?? 0) + 1);
  });

  return {
    todaySales: todayOrderRows.reduce((sum, order) => sum + Number(order.grand_total), 0),
    monthSales: monthOrderRows.reduce((sum, order) => sum + Number(order.grand_total), 0),
    ordersToday: todayOrderRows.length,
    pendingDeliveries: pendingDeliveriesCount ?? 0,
    lowStockProducts: variantRows.filter((variant) => variant.stock_quantity > 0 && variant.stock_quantity <= variant.minimum_stock).length,
    outOfStockProducts: variantRows.filter((variant) => variant.stock_quantity === 0).length,
    recentOrders: (recentOrders ?? []) as unknown as OrderRelationRow[],
    bestSellers: [...bestSellerMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    salesChart: lastSevenDays,
    paymentSummary: [...paymentMap.entries()].map(([status, count]) => ({ status, count })),
    deliverySummary: [...deliveryMap.entries()].map(([status, count]) => ({ status, count })),
  };
}
