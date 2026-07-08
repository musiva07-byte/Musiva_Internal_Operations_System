"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckSquare, LayoutList, Search, Table2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderQueueRow } from "@/components/orders/order-queue-row";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/status-badge";
import { Pagination } from "@/components/products/pagination";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { FULFILMENT_METHOD_LABELS, PAYMENT_STATUSES } from "@/lib/constants";
import { titleize } from "@/lib/formatters/labels";
import {
  groupByDate,
  needsAttentionOrder,
  computeOrderSummary,
} from "@/lib/utils/queue";
import { bulkOrderActionAction } from "@/app/admin/orders/actions";
import { useRealtimeOrders } from "@/lib/realtime/hooks";
import type { OrderListItem, OrderTabCounts, PaginatedResult } from "@/types/app";

// ─── Tab config ───────────────────────────────────────────────────────────────

type Tab = "today" | "new" | "confirmed" | "in_fulfilment" | "completed" | "cancelled" | "all";

const TABS: { id: Tab; label: string; countKey: keyof OrderTabCounts }[] = [
  { id: "today", label: "Today", countKey: "today" },
  { id: "new", label: "New", countKey: "new" },
  { id: "confirmed", label: "Confirmed", countKey: "confirmed" },
  { id: "in_fulfilment", label: "In Fulfilment", countKey: "in_fulfilment" },
  { id: "completed", label: "Completed", countKey: "completed" },
  { id: "cancelled", label: "Cancelled", countKey: "cancelled" },
  { id: "all", label: "All orders", countKey: "all" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  orders: PaginatedResult<OrderListItem>;
  tabCounts: OrderTabCounts;
  currentTab: string;
  currentView: "compact" | "detailed";
  currentQ: string;
  currentPaymentStatus: string;
  currentFulfilment: string;
};

// ─── Helper to build query string ────────────────────────────────────────────

function buildUrl(base: string, params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ orders }: { orders: OrderListItem[] }) {
  const { count, total, attentionCount } = computeOrderSummary(orders);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span>
        <span className="font-semibold text-foreground">{count}</span>
        {" "}order{count !== 1 ? "s" : ""}
      </span>
      <span className="font-semibold text-musiva-plum">{formatBhd(total)}</span>
      {attentionCount > 0 && (
        <span className="flex items-center gap-1 text-amber-700">
          <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
          {attentionCount} need{attentionCount !== 1 ? "" : "s"} attention
        </span>
      )}
    </div>
  );
}

// ─── Date-grouped compact list ────────────────────────────────────────────────

function CompactList({
  orders,
  emptyContent,
  selectedIds,
  onSelect,
}: {
  orders: OrderListItem[];
  emptyContent: ReactNode;
  selectedIds: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
}) {
  const groups = useMemo(() => groupByDate(orders), [orders]);

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[hsl(var(--border))] py-14 text-center text-muted-foreground">
        {emptyContent}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.dateKey}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {group.label}
          </p>
          <div className="space-y-1.5">
            {group.items.map((order) => (
              <OrderQueueRow
                key={order.id}
                order={order}
                isSelected={selectedIds.has(order.id)}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Detailed table ───────────────────────────────────────────────────────────

function DetailedTable({
  orders,
  emptyContent,
  selectedIds,
  onSelect,
}: {
  orders: OrderListItem[];
  emptyContent: ReactNode;
  selectedIds: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
}) {
  const router = useRouter();

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[hsl(var(--border))] py-14 text-center text-muted-foreground">
        {emptyContent}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <span className="sr-only">Select</span>
            </TableHead>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Fulfilment</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const attention = needsAttentionOrder(order);
            return (
              <TableRow
                key={order.id}
                className={attention ? "bg-amber-50/30" : undefined}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer rounded border-[hsl(var(--input))] accent-[var(--brand-mauve)]"
                    checked={selectedIds.has(order.id)}
                    onChange={(e) => onSelect(order.id, e.target.checked)}
                    aria-label={`Select ${order.order_number}`}
                  />
                </TableCell>
                <TableCell>
                  <button
                    className="font-medium text-musiva-plum hover:underline"
                    onClick={() => router.push(`/admin/orders/${order.id}`)}
                  >
                    {order.order_number}
                  </button>
                  {attention && (
                    <AlertTriangle
                      aria-label="Needs attention"
                      className="ml-1 inline h-3.5 w-3.5 text-amber-600"
                    />
                  )}
                </TableCell>
                <TableCell>
                  <p>{order.customer_name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{order.customer_mobile}</p>
                </TableCell>
                <TableCell>{formatDate(order.created_at)}</TableCell>
                <TableCell><OrderStatusBadge status={order.order_status} /></TableCell>
                <TableCell><PaymentStatusBadge status={order.payment_status} /></TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {FULFILMENT_METHOD_LABELS[order.fulfilment_method] ??
                      titleize(order.fulfilment_method)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatBhd(order.grand_total)}
                </TableCell>
                <TableCell>
                  {/* Minimal row action in detailed view */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => router.push(`/admin/orders/${order.id}`)}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OrderQueue({
  orders,
  tabCounts,
  currentTab,
  currentView,
  currentQ,
  currentPaymentStatus,
  currentFulfilment,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();
  const [bulkError, setBulkError] = useState<string | null>(null);

  // ── Realtime refresh ──────────────────────────────────────────────────────
  const refreshRef = useRef(router.refresh.bind(router));
  useEffect(() => {
    refreshRef.current = router.refresh.bind(router);
  });

  useRealtimeOrders(() => {
    refreshRef.current();
  });

  // ── Selection management ──────────────────────────────────────────────────

  function handleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(orders.data.map((o) => o.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  // ── Bulk action ───────────────────────────────────────────────────────────

  function handleBulkAction(action: "confirm") {
    if (selectedIds.size === 0) return;
    setBulkError(null);
    startBulkTransition(async () => {
      const result = await bulkOrderActionAction([...selectedIds], action);
      if (result.failCount > 0) {
        setBulkError(
          `${result.successCount} updated, ${result.failCount} failed: ${result.errors[0] ?? ""}`,
        );
      }
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  // ── URL helpers ───────────────────────────────────────────────────────────

  function tabUrl(tab: string) {
    return buildUrl("/admin/orders", {
      tab,
      view: currentView,
      q: currentQ,
      paymentStatus: currentPaymentStatus,
      fulfilment: currentFulfilment,
    });
  }

  function pageUrl(page: number) {
    return buildUrl("/admin/orders", {
      tab: currentTab,
      view: currentView,
      q: currentQ,
      paymentStatus: currentPaymentStatus,
      fulfilment: currentFulfilment,
      page: String(page),
    });
  }

  function viewUrl(view: "compact" | "detailed") {
    const params = Object.fromEntries(searchParams.entries());
    return buildUrl("/admin/orders", { ...params, view });
  }

  const allSelected =
    selectedIds.size > 0 && selectedIds.size === orders.data.length;
  const someSelected = selectedIds.size > 0;
  const hasActiveFilters = Boolean(currentQ || currentPaymentStatus || currentFulfilment);
  const emptyContent = orders.loadError ? orders.loadError : tabCounts.all === 0 && !hasActiveFilters ? (
    <div className="flex flex-col items-center gap-3"><div><p className="font-medium text-foreground">No orders yet.</p><p>Create your first sale to start tracking customer orders.</p></div><Button asChild size="sm"><Link href="/admin/orders/new">New sale</Link></Button></div>
  ) : "No orders found.";

  return (
    <div className="space-y-4">
      {/* ── Tab navigation ─────────────────────────────────────────────────── */}
      <nav
        className="flex gap-1 overflow-x-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] p-1"
        aria-label="Order tabs"
      >
        {TABS.map((tab) => {
          const count = tabCounts[tab.countKey];
          const isActive = currentTab === tab.id;
          return (
            <a
              key={tab.id}
              href={tabUrl(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white shadow-sm text-musiva-plum"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
              {count >= 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                    isActive
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "bg-[hsl(var(--muted))] text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      {/* ── Filter row ─────────────────────────────────────────────────────── */}
      <form
        className="flex flex-wrap items-center gap-2"
        method="get"
        action="/admin/orders"
      >
        <input type="hidden" name="tab" value={currentTab} />
        <input type="hidden" name="view" value={currentView} />

        <div className="relative">
          <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 w-56 pl-9 text-sm"
            defaultValue={currentQ}
            name="q"
            placeholder="Order number, name, mobile"
          />
        </div>

        <Select defaultValue={currentPaymentStatus} name="paymentStatus" className="h-8 w-40 text-sm">
          <option value="">All payment</option>
          {Object.values(PAYMENT_STATUSES).map((s) => (
            <option key={s} value={s}>{titleize(s)}</option>
          ))}
        </Select>

        <Select defaultValue={currentFulfilment} name="fulfilment" className="h-8 w-40 text-sm">
          <option value="">All fulfilment</option>
          <option value="delivery">Delivery</option>
          <option value="walk_in">Walk-in</option>
          <option value="customer_pickup">Pickup</option>
        </Select>

        <Button type="submit" size="sm" variant="outline" className="h-8">
          Filter
        </Button>

        {(currentQ || currentPaymentStatus || currentFulfilment) && (
          <a
            href={tabUrl(currentTab)}
            className="flex h-8 items-center gap-1 rounded-md px-2.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden className="h-3.5 w-3.5" />
            Reset
          </a>
        )}

        {/* View toggle */}
        <div className="ml-auto flex items-center gap-1 rounded-md border border-[hsl(var(--border))] p-0.5">
          <a
            href={viewUrl("compact")}
            className={`flex h-7 w-7 items-center justify-center rounded ${
              currentView === "compact"
                ? "bg-[hsl(var(--secondary))] shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Compact view"
          >
            <LayoutList aria-hidden className="h-4 w-4" />
            <span className="sr-only">Compact view</span>
          </a>
          <a
            href={viewUrl("detailed")}
            className={`flex h-7 w-7 items-center justify-center rounded ${
              currentView === "detailed"
                ? "bg-[hsl(var(--secondary))] shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Detailed view"
          >
            <Table2 aria-hidden className="h-4 w-4" />
            <span className="sr-only">Detailed view</span>
          </a>
        </div>
      </form>

      {/* ── Bulk action bar ─────────────────────────────────────────────────── */}
      {someSelected && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[hsl(var(--input))] accent-[var(--brand-mauve)]"
              checked={allSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
            {selectedIds.size} selected
          </label>

          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => handleBulkAction("confirm")}
              disabled={bulkPending}
            >
              <CheckSquare aria-hidden className="mr-1 h-3.5 w-3.5" />
              Confirm selected
            </Button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>

          {bulkError && <p className="text-xs text-destructive">{bulkError}</p>}
        </div>
      )}

      {/* ── Summary ─────────────────────────────────────────────────────────── */}
      <SummaryBar orders={orders.data} />

      {/* ── Order list ──────────────────────────────────────────────────────── */}
      {currentView === "compact" ? (
        <CompactList
          orders={orders.data}
          emptyContent={emptyContent}
          selectedIds={selectedIds}
          onSelect={handleSelect}
        />
      ) : (
        <DetailedTable
          orders={orders.data}
          emptyContent={emptyContent}
          selectedIds={selectedIds}
          onSelect={handleSelect}
        />
      )}

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      <Pagination
        href={pageUrl}
        page={orders.page}
        pageCount={orders.pageCount}
      />
    </div>
  );
}
