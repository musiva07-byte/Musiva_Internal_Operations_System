"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { RealtimeChannel } from "@supabase/supabase-js";

type StockPayload = {
  id: string;
  stock_quantity: number;
  minimum_stock: number;
};

type OrderPayload = {
  id: string;
  order_status: string;
  payment_status: string;
};

type DeliveryPayload = {
  id: string;
  delivery_status: string;
};

/**
 * Subscribes to live stock quantity updates for a single product variant.
 * Returns the latest stock_quantity or null until the first event arrives.
 */
export function useVariantStock(
  variantId: string,
  initialQuantity: number,
): number {
  const [quantity, setQuantity] = useState(initialQuantity);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase || !variantId) return;

    channelRef.current = supabase
      .channel(`variant-stock-${variantId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "product_variants",
          filter: `id=eq.${variantId}`,
        },
        (payload) => {
          const updated = payload.new as StockPayload;
          if (typeof updated.stock_quantity === "number") {
            setQuantity(updated.stock_quantity);
          }
        },
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [variantId]);

  return quantity;
}

export type LowStockAlert = {
  id: string;
  product_name?: string;
  variant_sku: string;
  stock_quantity: number;
  minimum_stock: number;
};

/**
 * Subscribes to product_variants changes and maintains a list of low-stock
 * items derived from the initial list. Updates reactively when variants change.
 */
export function useLowStockAlerts(
  initialAlerts: LowStockAlert[],
): LowStockAlert[] {
  const [alerts, setAlerts] = useState<LowStockAlert[]>(initialAlerts);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    channelRef.current = supabase
      .channel("low-stock-alerts")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "product_variants" },
        (payload) => {
          const updated = payload.new as StockPayload & { variant_sku?: string };
          setAlerts((prev) => {
            const isLow =
              updated.stock_quantity > 0 &&
              updated.stock_quantity <= updated.minimum_stock;
            const isOut = updated.stock_quantity === 0;
            const existing = prev.findIndex((a) => a.id === updated.id);

            if (isLow || isOut) {
              const next: LowStockAlert = {
                id: updated.id,
                variant_sku: updated.variant_sku ?? "",
                stock_quantity: updated.stock_quantity,
                minimum_stock: updated.minimum_stock,
              };
              if (existing >= 0) {
                return prev.map((a, i) => (i === existing ? next : a));
              }
              return [...prev, next];
            }

            // Item is back in healthy stock — remove from alerts
            if (existing >= 0) {
              return prev.filter((a) => a.id !== updated.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);

  return alerts;
}

/**
 * Subscribes to INSERT/UPDATE events on the orders table and calls the
 * provided callback. The callback receives the new order payload.
 */
export function useRealtimeOrders(
  onOrderChange: (payload: OrderPayload) => void,
): void {
  const callbackRef = useRef(onOrderChange);
  useEffect(() => {
    callbackRef.current = onOrderChange;
  });

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    channelRef.current = supabase
      .channel("realtime-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          callbackRef.current(payload.new as OrderPayload);
        },
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);
}

/**
 * Subscribes to UPDATE events on the deliveries table and calls the
 * provided callback whenever a delivery status changes.
 */
export function useRealtimeDeliveries(
  onDeliveryChange: (payload: DeliveryPayload) => void,
): void {
  const callbackRef = useRef(onDeliveryChange);
  useEffect(() => {
    callbackRef.current = onDeliveryChange;
  });

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    channelRef.current = supabase
      .channel("realtime-deliveries")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "deliveries" },
        (payload) => {
          callbackRef.current(payload.new as DeliveryPayload);
        },
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);
}

/**
 * Returns a callback that increments a counter each time a realtime event
 * fires on the specified table. Useful to trigger a server-side refresh on
 * a dashboard using router.refresh().
 *
 * Usage:
 *   const tick = useDashboardRefreshTick(["orders", "deliveries", "product_variants"]);
 *   useEffect(() => { router.refresh(); }, [tick]);
 */
export function useDashboardRefreshTick(tables: string[]): number {
  const [tick, setTick] = useState(0);
  const increment = useCallback(() => setTick((n) => n + 1), []);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase || tables.length === 0) return;

    const channel = supabase.channel("dashboard-refresh");

    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        increment,
      );
    }

    channelRef.current = channel;
    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
    // tables is a stable array passed from component render — only run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return tick;
}
