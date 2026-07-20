import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Coins,
  Globe,
  PackageCheck,
  PackagePlus,
  PackageX,
  Percent,
  Printer,
  ShoppingBag,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDashboardData } from "@/lib/services/dashboard.service";
import { getCurrentAuthState } from "@/lib/auth/session";
import { canViewBuyingCost, canViewCostData } from "@/lib/auth/permissions";
import { formatBhd } from "@/lib/formatters/currency";
import { formatInr } from "@/lib/utils/cost-conversion";
import { formatDateTime } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Server component fetching fresh data on every request — never cache stale business figures.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const [dashboard, auth] = await Promise.all([getDashboardData(), getCurrentAuthState()]);
  const role = auth.profile?.role ?? null;
  // Tier 1: buying cost figures only (no profit/margin) — owner, manager, inventory staff, accountant.
  const canSeeCost = canViewBuyingCost(role);
  // Tier 2: full financial picture — profit, margin, breakdown, low-margin alerts.
  const canSeeProfit = canViewCostData(role);

  const maxSales = Math.max(...dashboard.salesChart.map((day) => day.total), 1);
  const codOrders = dashboard.paymentSummary.find((item) => item.status === "cod")?.count ?? 0;
  const unpaidOrders = dashboard.paymentSummary.find((item) => item.status === "unpaid")?.count ?? 0;
  const allSalesZero = dashboard.salesChart.every((day) => day.total === 0);
  const weekTotal = dashboard.salesChart.reduce((sum, day) => sum + day.total, 0);
  const stockAlertTotal = dashboard.lowStockProducts + dashboard.outOfStockProducts;
  const hasValidStockCost = dashboard.validBuyingCostCount > 0;

  type DashboardCard = {
    title: string;
    value: string;
    helper: string;
    icon: React.ElementType;
    href?: string;
  };

  const cards: DashboardCard[] = [
    {
      title: "Today sales",
      value: formatBhd(dashboard.todaySales),
      helper: "Confirmed non-cancelled orders today.",
      icon: CircleDollarSign,
    },
    {
      title: "This month",
      value: formatBhd(dashboard.monthSales),
      helper: "Month-to-date gross sales.",
      icon: CalendarDays,
    },
    {
      title: "Orders today",
      value: String(dashboard.ordersToday),
      helper: "All active order sources.",
      icon: ShoppingBag,
    },
    {
      title: "Pending deliveries",
      value: String(dashboard.pendingDeliveries),
      helper: "Packed, courier, and delivery queue.",
      icon: Truck,
      href: "/admin/deliveries?tab=pending",
    },
    {
      title: "Website requests",
      value: String(dashboard.newWebsiteRequests),
      helper: `${dashboard.newWebsiteRequests} new request${dashboard.newWebsiteRequests === 1 ? "" : "s"} waiting.`,
      icon: Globe,
      href: "/admin/website-requests?tab=new",
    },
    {
      title: "Stock alerts",
      value: String(stockAlertTotal),
      helper: `${dashboard.lowStockProducts} low stock · ${dashboard.outOfStockProducts} out of stock.`,
      icon: PackageX,
      href: "/admin/inventory?stock=low",
    },
  ];

  const quickActions = [
    {
      title: "New sale",
      helper: "Create an order, save customer details, deduct stock.",
      href: "/admin/orders/new",
      icon: ShoppingBag,
      primary: true,
    },
    {
      title: "Receive stock",
      helper: "Add newly received items to available stock.",
      href: "/admin/inventory/stock-entry",
      icon: PackagePlus,
      primary: false,
    },
    {
      title: "Website requests",
      helper: "Follow up on new checkout requests.",
      href: "/admin/website-requests?tab=new",
      icon: Globe,
      primary: false,
    },
    {
      title: "Print delivery label",
      helper: "Open the delivery queue and print labels.",
      href: "/admin/deliveries",
      icon: Printer,
      primary: false,
    },
    {
      title: "View low stock",
      helper: "See variants running low and take action.",
      href: "/admin/inventory?stock=low",
      icon: Truck,
      primary: false,
    },
  ];

  type AttentionItem = { label: string; value: number; href: string; tone: string };

  const attentionItems: AttentionItem[] = [
    {
      label: "New website requests",
      value: dashboard.newWebsiteRequests,
      href: "/admin/website-requests?tab=new",
      tone: dashboard.newWebsiteRequests > 0 ? "text-musiva-warning" : "text-musiva-sage",
    },
    {
      label: "Pending deliveries",
      value: dashboard.pendingDeliveries,
      href: "/admin/deliveries?tab=pending",
      tone: dashboard.pendingDeliveries > 0 ? "text-musiva-warning" : "text-musiva-sage",
    },
    {
      label: "Failed deliveries",
      value: dashboard.failedDeliveries,
      href: "/admin/deliveries?tab=failed",
      tone: dashboard.failedDeliveries > 0 ? "text-musiva-danger" : "text-musiva-sage",
    },
    {
      label: "Low stock variants",
      value: dashboard.lowStockProducts,
      href: "/admin/inventory?stock=low",
      tone: dashboard.lowStockProducts > 0 ? "text-musiva-warning" : "text-musiva-sage",
    },
    {
      label: "Out of stock variants",
      value: dashboard.outOfStockProducts,
      href: "/admin/inventory?stock=out",
      tone: dashboard.outOfStockProducts > 0 ? "text-musiva-danger" : "text-musiva-sage",
    },
    {
      label: "COD orders this month",
      value: codOrders,
      href: "/admin/orders?paymentStatus=cod",
      tone: codOrders > 0 ? "text-musiva-warning" : "text-musiva-sage",
    },
    {
      label: "Unpaid orders this month",
      value: unpaidOrders,
      href: "/admin/orders?paymentStatus=unpaid",
      tone: unpaidOrders > 0 ? "text-musiva-danger" : "text-musiva-sage",
    },
    // Cost data — only shown to roles permitted to see profit/margin (see canSeeProfit above).
    ...(canSeeProfit
      ? [
          {
            label: "Variants missing buying cost",
            value: dashboard.missingCostVariantCount,
            href: "/admin/reports/product-costs?missingCost=1",
            tone: dashboard.missingCostVariantCount > 0 ? "text-musiva-warning" : "text-musiva-sage",
          },
        ]
      : []),
  ];

  const allClear = attentionItems.every((item) => item.value === 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">
            Internal operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Start daily work, check urgent items, and see boutique performance in one place.
          </p>
        </div>
        <div className="rounded-md border bg-card px-4 py-3 text-right shadow-soft">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Currency</p>
          <p className="mt-1 text-lg font-semibold text-musiva-plum">BHD</p>
        </div>
      </header>

      {dashboard.loadError ? (
        <Card className="border-destructive/40 shadow-soft">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {dashboard.loadError}
          </CardContent>
        </Card>
      ) : null}

      {/* ── Start here (quick actions) ─────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-musiva-plum">Start here</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Common daily tasks for sales, stock, and delivery staff.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/orders">
              View orders
              <ArrowRight aria-hidden className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                className={
                  action.primary
                    ? "group rounded-md border border-musiva-plum bg-musiva-plum p-4 text-primary-foreground shadow-soft transition-colors hover:bg-musiva-plum/90"
                    : "group rounded-md border bg-card p-4 shadow-soft transition-colors hover:border-musiva-pink hover:bg-musiva-ivory"
                }
                href={action.href}
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={
                      action.primary
                        ? "rounded-md bg-white/15 p-2"
                        : "rounded-md bg-musiva-ivory p-2 text-musiva-gold group-hover:bg-white"
                    }
                  >
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="h-4 w-4 opacity-70 transition-transform group-hover:translate-x-1"
                  />
                </div>
                <p
                  className={
                    action.primary
                      ? "mt-4 font-semibold text-white"
                      : "mt-4 font-semibold text-musiva-plum"
                  }
                >
                  {action.title}
                </p>
                <p
                  className={
                    action.primary
                      ? "mt-1 text-sm leading-5 text-white/80"
                      : "mt-1 text-sm leading-5 text-muted-foreground"
                  }
                >
                  {action.helper}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Today's business (top KPIs) ──────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-musiva-plum">Today&apos;s business</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {cards.map((card) => {
            const Icon = card.icon;
            const content = (
              <Card
                className={
                  card.href
                    ? "h-full border-musiva-champagne/60 bg-musiva-porcelain shadow-soft transition-colors hover:border-musiva-pink"
                    : "h-full border-musiva-champagne/60 bg-musiva-porcelain shadow-soft"
                }
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                  <span className="rounded-md bg-musiva-ivory p-2 text-musiva-gold">
                    <Icon aria-hidden className="h-4 w-4" />
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-musiva-plum">{card.value}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{card.helper}</p>
                </CardContent>
              </Card>
            );

            return card.href ? (
              <Link key={card.title} href={card.href}>
                {content}
              </Link>
            ) : (
              <div key={card.title}>{content}</div>
            );
          })}
        </div>
      </section>

      {/* ── Business Stock Value (owner / manager / inventory / accountant) ── */}
      {canSeeCost && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-musiva-plum">Business Stock Value</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Moosiva buys in India (INR) and sells in Bahrain (BHD). Figures below use only
              variants with a complete, valid buying cost.
            </p>
          </div>
          <Card className="shadow-soft">
            <CardContent className="space-y-5 pt-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SnapshotStat
                  icon={Boxes}
                  label="Total stock units"
                  value={String(dashboard.totalStockUnits)}
                />
                <SnapshotStat
                  icon={Wallet}
                  label="Buying value in India"
                  value={hasValidStockCost ? formatInr(dashboard.totalBuyingValueInr) : "Not recorded"}
                />
                <SnapshotStat
                  icon={Coins}
                  label="Final stock cost in Bahrain"
                  value={hasValidStockCost ? formatBhd(dashboard.totalFinalCostBhd) : "Not recorded"}
                />
                <SnapshotStat
                  icon={AlertTriangle}
                  label="Missing buying cost"
                  value={`${dashboard.missingCostVariantCount} variant${dashboard.missingCostVariantCount === 1 ? "" : "s"}`}
                  tone={dashboard.missingCostVariantCount > 0 ? "text-musiva-warning" : undefined}
                />
              </div>

              {!hasValidStockCost ? (
                <p className="border-t border-[hsl(var(--border))] pt-4 text-sm text-muted-foreground">
                  No valid buying cost recorded yet. Add buying price in INR to products to
                  calculate stock value.
                </p>
              ) : canSeeProfit ? (
                <div className="grid gap-4 border-t border-[hsl(var(--border))] pt-4 sm:grid-cols-3">
                  <SnapshotStat
                    icon={TrendingUp}
                    label="Estimated selling value"
                    value={formatBhd(dashboard.estimatedSellingValueBhd)}
                  />
                  <SnapshotStat
                    icon={CircleDollarSign}
                    label="Estimated gross profit"
                    value={formatBhd(dashboard.estimatedGrossProfitBhd)}
                  />
                  <SnapshotStat
                    icon={Percent}
                    label="Estimated margin"
                    value={
                      dashboard.estimatedMarginPercent !== null
                        ? `${dashboard.estimatedMarginPercent.toFixed(2)}%`
                        : "—"
                    }
                  />
                </div>
              ) : null}

              <p className="border-t border-[hsl(var(--border))] pt-4 text-xs text-muted-foreground">
                {dashboard.latestExchangeRate !== null
                  ? `1 INR = ${Number(dashboard.latestExchangeRate).toFixed(6)} BHD`
                  : "Exchange rate not set"}
              </p>
            </CardContent>
          </Card>

          {canSeeProfit && dashboard.missingCostVariantCount > 0 && (
            <Card className="border-musiva-warning/40 bg-musiva-warning/5 shadow-soft">
              <CardContent className="flex flex-col items-start justify-between gap-3 pt-6 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-musiva-warning" />
                  <div>
                    <p className="font-medium text-musiva-plum">
                      {dashboard.missingCostVariantCount} variant
                      {dashboard.missingCostVariantCount === 1 ? "" : "s"} missing buying cost.
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add INR buying price and exchange rate to complete stock valuation.
                    </p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link href="/admin/reports/product-costs?missingCost=1">View missing costs</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* ── Needs attention + 7-day sales ────────────────────────────────── */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent>
            {allClear ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2
                  aria-hidden
                  className="h-9 w-9 text-musiva-sage"
                />
                <p className="mt-3 font-medium text-musiva-sage">All clear</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  No urgent items right now.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {attentionItems.map((item) => (
                  <Link
                    key={item.label}
                    className="group flex items-center justify-between gap-4 rounded-md bg-musiva-ivory p-4 transition-colors hover:bg-muted"
                    href={item.href}
                  >
                    <div className="flex items-center gap-3">
                      <PackageCheck aria-hidden className={item.tone} />
                      <p className="text-sm font-medium">{item.label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-2xl font-semibold ${item.tone}`}>
                        {item.value}
                      </p>
                      <ArrowRight
                        aria-hidden
                        className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1"
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>7-day sales</CardTitle>
                {!allSalesZero && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatBhd(weekTotal)} total over the last 7 days
                  </p>
                )}
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/reports/sales">
                  <BarChart3 aria-hidden className="mr-2 h-4 w-4" />
                  Sales report
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {allSalesZero ? (
              <div className="flex h-44 flex-col items-center justify-center text-center">
                <p className="text-sm text-muted-foreground">No sales in the last 7 days.</p>
              </div>
            ) : (
              <div className="flex h-44 items-end gap-3">
                {dashboard.salesChart.map((day) => (
                  <div key={day.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-32 w-full items-end rounded-md bg-musiva-ivory px-2">
                      <div
                        className="w-full rounded-t-md bg-musiva-pink"
                        style={{
                          height: `${Math.max(4, (day.total / maxSales) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{day.label}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Recent orders / best sellers / status summaries ──────────────── */}
      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.recentOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="h-24 text-center text-muted-foreground"
                    colSpan={4}
                  >
                    No orders yet.
                  </TableCell>
                </TableRow>
              ) : (
                dashboard.recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link
                        className="font-medium text-musiva-plum hover:underline"
                        href={`/admin/orders/${order.id}`}
                      >
                        {order.order_number}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(order.created_at)}
                      </p>
                    </TableCell>
                    <TableCell>
                      {order.customers?.full_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          order.order_status === "cancelled"
                            ? "danger"
                            : order.order_status === "completed" ||
                              order.order_status === "delivered"
                            ? "success"
                            : "secondary"
                        }
                      >
                        {titleize(order.order_status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatBhd(order.grand_total)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Best-selling products</CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/reports/sales">View report</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.bestSellers.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No sales data yet.
                </p>
              ) : (
                dashboard.bestSellers.map((product) => (
                  <div
                    key={product.name}
                    className="flex items-center justify-between gap-3 rounded-md bg-musiva-ivory p-3"
                  >
                    <div>
                      <p className="font-medium text-musiva-plum">{product.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {product.quantity} units sold
                      </p>
                    </div>
                    <p className="text-sm font-medium">{formatBhd(product.revenue)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Payment status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {dashboard.paymentSummary.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payment data yet.</p>
              ) : (
                dashboard.paymentSummary.map((item) => (
                  <Badge
                    key={item.status}
                    variant={
                      item.status === "paid"
                        ? "success"
                        : item.status === "unpaid"
                        ? "danger"
                        : "warning"
                    }
                  >
                    {titleize(item.status)}: {item.count}
                  </Badge>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Delivery status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {dashboard.deliverySummary.length === 0 ? (
                <p className="text-sm text-muted-foreground">No delivery records yet.</p>
              ) : (
                dashboard.deliverySummary.map((item) => (
                  <Badge
                    key={item.status}
                    variant={
                      item.status === "delivered"
                        ? "success"
                        : item.status === "failed" || item.status === "returned_to_store"
                        ? "danger"
                        : "warning"
                    }
                  >
                    {titleize(item.status)}: {item.count}
                  </Badge>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Product Cost Breakdown + Low-margin (owner / manager / accountant) ── */}
      {canSeeProfit && (
        <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Product Cost Breakdown</CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/reports/product-costs">
                  Full report
                  <ArrowRight aria-hidden className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            {dashboard.productCostBreakdown.length === 0 ? (
              <CardContent className="pt-0">
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No product cost data recorded yet.
                </p>
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Buying (INR)</TableHead>
                    <TableHead className="text-right">Final cost (BHD)</TableHead>
                    <TableHead className="text-right">Est. selling</TableHead>
                    <TableHead className="text-right">Est. profit</TableHead>
                    <TableHead className="text-right">Missing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.productCostBreakdown.map((product) => (
                    <TableRow key={product.productId}>
                      <TableCell>
                        <Link
                          className="font-medium text-musiva-plum hover:underline"
                          href={`/admin/products/${product.productId}`}
                        >
                          {product.productName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">{product.totalStock}</TableCell>
                      <TableCell className="text-right">
                        {formatInr(product.totalBuyingValueInr)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBhd(product.totalFinalCostBhd)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBhd(product.estimatedSellingValueBhd)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBhd(product.estimatedProfitBhd)}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.missingCostCount > 0 ? (
                          <Badge className="text-[10px]" variant="warning">
                            {product.missingCostCount}
                          </Badge>
                        ) : (
                          0
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Low-margin products</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Options under 20% margin.</p>
            </CardHeader>
            <CardContent>
              {!hasValidStockCost ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No margin data yet.</p>
              ) : dashboard.lowMarginVariants.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  All products meet the 20% margin target.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {dashboard.lowMarginVariants.map((item) => (
                    <Badge key={item.name} variant="warning">
                      {item.name}: {item.margin.toFixed(1)}%
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function SnapshotStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 rounded-md bg-musiva-ivory p-2 text-musiva-gold">
        <Icon aria-hidden className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-lg font-semibold ${tone ?? "text-musiva-plum"}`}>{value}</p>
      </div>
    </div>
  );
}
