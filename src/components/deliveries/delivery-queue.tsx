"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckSquare, LayoutList, Search, Table2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeliveryQueueRow } from "@/components/deliveries/delivery-queue-row";
import { DeliveryStatusBadge } from "@/components/deliveries/delivery-status-badge";
import { PaymentStatusBadge } from "@/components/orders/status-badge";
import { Pagination } from "@/components/products/pagination";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import {
  groupByDate,
  needsAttentionDelivery,
  computeDeliverySummary,
} from "@/lib/utils/queue";
import { bulkDeliveryActionAction } from "@/app/admin/deliveries/actions";
import { useRealtimeDeliveries } from "@/lib/realtime/hooks";
import type { DeliveryListItem, DeliveryTabCounts, PaginatedResult } from "@/types/app";
import type { PaymentStatus } from "@/types/database";

// ─── Tab config ───────────────────────────────────────────────────────────────

type Tab = "today" | "pending" | "packed" | "ready" | "out_for_delivery" | "failed" | "delivered" | "all";

const TABS: { id: Tab; label: string; countKey: keyof DeliveryTabCounts }[] = [
  { id: "today", label: "Today", countKey: "today" },
  { id: "pending", label: "Pending", countKey: "pending" },
  { id: "packed", label: "Packed", countKey: "packed" },
  { id: "ready", label: "Ready", countKey: "ready" },
  { id: "out_for_delivery", label: "Out for delivery", countKey: "out_for_delivery" },
  { id: "failed", label: "Failed", countKey: "failed" },
  { id: "delivered", label: "Delivered", countKey: "delivered" },
  { id: "all", label: "All", countKey: "all" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  deliveries: PaginatedResult<DeliveryListItem>;
  tabCounts: DeliveryTabCounts;
  currentTab: Tab;
  currentView: "compact" | "detailed";
  currentQ: string;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildUrl(base: string, params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ deliveries }: { deliveries: DeliveryListItem[] }) {
  const { pending, outForDelivery, attentionCount } = computeDeliverySummary(deliveries);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      {pending > 0 && (
        <span>
          <span className="font-semibold text-foreground">{pending}</span> pending
        </span>
      )}
      {outForDelivery > 0 && (
        <span>
          <span className="font-semibold text-foreground">{outForDelivery}</span> out for delivery
        </span>
      )}
      {pending === 0 && outForDelivery === 0 && (
        <span>
          <span className="font-semibold text-foreground">{deliveries.length}</span> record
          {deliveries.length !== 1 ? "s" : ""}
        </span>
      )}
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
  deliveries,
  selectedIds,
  onSelect,
}: {
  deliveries: DeliveryListItem[];
  selectedIds: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
}) {
  const groups = useMemo(() => groupByDate(deliveries), [deliveries]);

  if (deliveries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[hsl(var(--border))] py-14 text-center text-muted-foreground">
        No deliveries found.
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
            {group.items.map((delivery) => (
              <DeliveryQueueRow
                key={delivery.id}
                delivery={delivery}
                isSelected={selectedIds.has(delivery.id)}
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
  deliveries,
  selectedIds,
  onSelect,
}: {
  deliveries: DeliveryListItem[];
  selectedIds: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
}) {
  const router = useRouter();

  if (deliveries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[hsl(var(--border))] py-14 text-center text-muted-foreground">
        No deliveries found.
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
            <TableHead>Address</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveries.map((delivery) => {
            const attention = needsAttentionDelivery(delivery);
            return (
              <TableRow
                key={delivery.id}
                className={
                  attention === "failed"
                    ? "bg-red-50/20"
                    : attention
                      ? "bg-amber-50/30"
                      : undefined
                }
              >
                <TableCell>
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer rounded border-[hsl(var(--input))] accent-[var(--brand-mauve)]"
                    checked={selectedIds.has(delivery.id)}
                    onChange={(e) => onSelect(delivery.id, e.target.checked)}
                    aria-label={`Select ${delivery.order_number}`}
                  />
                </TableCell>
                <TableCell>
                  <button
                    className="font-medium text-musiva-plum hover:underline"
                    onClick={() => router.push(`/admin/deliveries/${delivery.id}`)}
                  >
                    {delivery.order_number}
                  </button>
                  {attention && (
                    <AlertTriangle
                      aria-label="Needs attention"
                      className="ml-1 inline h-3.5 w-3.5 text-amber-600"
                    />
                  )}
                </TableCell>
                <TableCell>
                  <p>{delivery.customer_name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{delivery.phone}</p>
                </TableCell>
                <TableCell>
                  <p>{delivery.area ?? "—"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {delivery.governorate ?? "—"}
                  </p>
                </TableCell>
                <TableCell>
                  {delivery.delivery_date ? formatDate(delivery.delivery_date) : "—"}
                </TableCell>
                <TableCell>
                  <DeliveryStatusBadge status={delivery.delivery_status} />
                </TableCell>
                <TableCell>
                  <PaymentStatusBadge status={delivery.payment_status as PaymentStatus} />
                  {delivery.amount_due > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Collect {formatBhd(delivery.amount_due)}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => router.push(`/admin/deliveries/${delivery.id}`)}
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

export function DeliveryQueue({
  deliveries,
  tabCounts,
  currentTab,
  currentView,
  currentQ,
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

  useRealtimeDeliveries(() => {
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
      setSelectedIds(new Set(deliveries.data.map((d) => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  // ── Bulk action ───────────────────────────────────────────────────────────

  function handleBulkAction(newStatus: "packed" | "ready_for_pickup") {
    if (selectedIds.size === 0) return;
    setBulkError(null);
    startBulkTransition(async () => {
      const result = await bulkDeliveryActionAction([...selectedIds], newStatus);
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

  function tabUrl(tab: Tab) {
    return buildUrl("/admin/deliveries", { tab, view: currentView, q: currentQ });
  }

  function pageUrl(page: number) {
    return buildUrl("/admin/deliveries", {
      tab: currentTab,
      view: currentView,
      q: currentQ,
      page: String(page),
    });
  }

  function viewUrl(view: "compact" | "detailed") {
    const params = Object.fromEntries(searchParams.entries());
    return buildUrl("/admin/deliveries", { ...params, view });
  }

  const allSelected =
    selectedIds.size > 0 && selectedIds.size === deliveries.data.length;
  const someSelected = selectedIds.size > 0;

  return (
    <div className="space-y-4">
      {/* ── Tab navigation ─────────────────────────────────────────────────── */}
      <nav
        className="flex gap-1 overflow-x-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] p-1"
        aria-label="Delivery tabs"
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
              {count > 0 && (
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
        action="/admin/deliveries"
      >
        <input type="hidden" name="tab" value={currentTab} />
        <input type="hidden" name="view" value={currentView} />

        <div className="relative">
          <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 w-56 pl-9 text-sm"
            defaultValue={currentQ}
            name="q"
            placeholder="Order, name, phone, area"
          />
        </div>

        <Button type="submit" size="sm" variant="outline" className="h-8">
          Search
        </Button>

        {currentQ && (
          <a
            href={tabUrl(currentTab)}
            className="flex h-8 items-center gap-1 rounded-md px-2.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden className="h-3.5 w-3.5" />
            Clear
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
              onClick={() => handleBulkAction("packed")}
              disabled={bulkPending}
            >
              <CheckSquare aria-hidden className="mr-1 h-3.5 w-3.5" />
              Mark packed
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => handleBulkAction("ready_for_pickup")}
              disabled={bulkPending}
            >
              Mark ready
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
      <SummaryBar deliveries={deliveries.data} />

      {/* ── Delivery list ─────────────────────────────────────────────────── */}
      {currentView === "compact" ? (
        <CompactList
          deliveries={deliveries.data}
          selectedIds={selectedIds}
          onSelect={handleSelect}
        />
      ) : (
        <DetailedTable
          deliveries={deliveries.data}
          selectedIds={selectedIds}
          onSelect={handleSelect}
        />
      )}

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      <Pagination href={pageUrl} page={deliveries.page} pageCount={deliveries.pageCount} />
    </div>
  );
}
