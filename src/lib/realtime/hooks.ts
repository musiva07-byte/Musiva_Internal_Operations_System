"use client";

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { RealtimeChannel } from "@supabase/supabase-js";

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

