"use client";

import { useRouter } from "next/navigation";
import { LayoutGrid, Search, Table2, X } from "lucide-react";
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
import { WebsiteRequestStatusBadge } from "@/components/website-requests/website-request-status-badge";
import { WebsiteRequestCard } from "@/components/website-requests/website-request-card";
import { Pagination } from "@/components/products/pagination";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDateTime } from "@/lib/formatters/date";
import { WEBSITE_REQUEST_PAYMENT_PREFERENCE_LABELS } from "@/lib/constants/statuses";
import { cn } from "@/lib/utils";
import type { StaffRole } from "@/lib/constants";
import type { PaginatedResult, WebsiteRequestListItem, WebsiteRequestTabCounts } from "@/types/app";

type Tab = "new" | "contacted" | "confirmed" | "cancelled" | "all";
type View = "card" | "table";

const TABS: { id: Tab; label: string; countKey: keyof WebsiteRequestTabCounts }[] = [
  { id: "new", label: "New", countKey: "new" },
  { id: "contacted", label: "Contacted", countKey: "contacted" },
  { id: "confirmed", label: "Confirmed", countKey: "confirmed" },
  { id: "cancelled", label: "Cancelled", countKey: "cancelled" },
  { id: "all", label: "All", countKey: "all" },
];

type Props = {
  requests: PaginatedResult<WebsiteRequestListItem>;
  tabCounts: WebsiteRequestTabCounts;
  currentTab: Tab;
  currentQ: string;
  currentView: View;
  role: StaffRole | null | undefined;
};

function buildUrl(base: string, params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

export function WebsiteRequestQueue({
  requests,
  tabCounts,
  currentTab,
  currentQ,
  currentView,
  role,
}: Props) {
  const router = useRouter();

  function tabUrl(tab: Tab) {
    return buildUrl("/admin/website-requests", { tab, q: currentQ, view: currentView });
  }

  function pageUrl(page: number) {
    return buildUrl("/admin/website-requests", {
      tab: currentTab,
      q: currentQ,
      view: currentView,
      page: String(page),
    });
  }

  function viewUrl(view: View) {
    return buildUrl("/admin/website-requests", { tab: currentTab, q: currentQ, view });
  }

  const emptyContent = requests.loadError
    ? requests.loadError
    : tabCounts.all === 0 && !currentQ
      ? (
          <div>
            <p className="font-medium text-foreground">No website requests yet.</p>
            <p>Customer requests from www.moosivabh.com will appear here.</p>
          </div>
        )
      : "No website requests found.";

  return (
    <div className="space-y-4">
      {/* ── Tab navigation ─────────────────────────────────────────────────── */}
      <nav
        className="flex gap-1 overflow-x-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] p-1"
        aria-label="Website request tabs"
      >
        {TABS.map((tab) => {
          const count = tabCounts[tab.countKey];
          const isActive = currentTab === tab.id;
          return (
            <a
              key={tab.id}
              href={tabUrl(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white shadow-sm text-musiva-plum"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                    isActive
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "bg-[hsl(var(--muted))] text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      {/* ── Search + view toggle ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form className="flex w-full flex-wrap items-center gap-2 sm:max-w-md" method="get" action="/admin/website-requests">
          <input type="hidden" name="tab" value={currentTab} />
          <input type="hidden" name="view" value={currentView} />

          <div className="relative flex-1">
            <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 w-full pl-9 text-sm"
              defaultValue={currentQ}
              name="q"
              placeholder="Request no, name, mobile, product"
            />
          </div>

          <Button type="submit" size="sm" variant="outline" className="h-9">
            Search
          </Button>

          {currentQ && (
            <a
              href={tabUrl(currentTab)}
              className="flex h-9 items-center gap-1 rounded-md px-2.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
              Clear
            </a>
          )}
        </form>

        {/* View toggle — desktop only; mobile and tablet always show cards regardless. */}
        <div className="hidden shrink-0 items-center gap-1 rounded-lg border border-[hsl(var(--border))] p-1 md:flex">
          <a
            href={viewUrl("card")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              currentView === "card"
                ? "bg-musiva-blush text-musiva-plum"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={currentView === "card" ? "page" : undefined}
          >
            <LayoutGrid aria-hidden className="h-3.5 w-3.5" />
            Card view
          </a>
          <a
            href={viewUrl("table")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              currentView === "table"
                ? "bg-musiva-blush text-musiva-plum"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={currentView === "table" ? "page" : undefined}
          >
            <Table2 aria-hidden className="h-3.5 w-3.5" />
            Table view
          </a>
        </div>
      </div>

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {requests.data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[hsl(var(--border))] py-14 text-center text-muted-foreground">
          {emptyContent}
        </div>
      ) : (
        <>
          {/* Card queue — the default view everywhere, and always shown on mobile/tablet
              even when "table" is selected, so staff never has to scroll horizontally. */}
          <div className={cn("space-y-3", currentView === "table" && "md:hidden")}>
            {requests.data.map((request) => (
              <WebsiteRequestCard key={request.id} request={request} role={role} />
            ))}
          </div>

          {/* Table view — desktop only, opt-in via the toggle above. */}
          {currentView === "table" && (
            <div className="hidden overflow-x-auto rounded-lg border border-[hsl(var(--border))] md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Mobile / WhatsApp</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.data.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <button
                          className="font-medium text-musiva-plum hover:underline"
                          onClick={() => router.push(`/admin/website-requests/${request.id}`)}
                        >
                          {request.request_number}
                        </button>
                      </TableCell>
                      <TableCell>{formatDateTime(request.created_at)}</TableCell>
                      <TableCell>{request.customer_name}</TableCell>
                      <TableCell>
                        <p>{request.mobile_display}</p>
                        {request.whatsapp_display !== request.mobile_display && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            WA: {request.whatsapp_display}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{request.product_name_snapshot}</TableCell>
                      <TableCell>{request.color_snapshot ?? "—"}</TableCell>
                      <TableCell>{request.size_snapshot ?? "—"}</TableCell>
                      <TableCell className="text-right">{request.quantity}</TableCell>
                      <TableCell className="text-right">{formatBhd(request.total_snapshot)}</TableCell>
                      <TableCell>
                        {WEBSITE_REQUEST_PAYMENT_PREFERENCE_LABELS[request.payment_preference] ??
                          request.payment_preference}
                      </TableCell>
                      <TableCell>
                        <WebsiteRequestStatusBadge status={request.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => router.push(`/admin/website-requests/${request.id}`)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      <Pagination href={pageUrl} page={requests.page} pageCount={requests.pageCount} />
    </div>
  );
}
