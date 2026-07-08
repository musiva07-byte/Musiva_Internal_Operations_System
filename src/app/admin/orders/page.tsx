import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderQueue } from "@/components/orders/order-queue";
import { listOrders, listOrdersTabCounts } from "@/lib/services/order.service";

type OrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

const VALID_TABS = new Set([
  "today",
  "new",
  "confirmed",
  "in_fulfilment",
  "completed",
  "cancelled",
  "all",
]);

const VALID_VIEWS = new Set(["compact", "detailed"]);

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;

  const rawTab = getParam(params, "tab");
  const tab = (VALID_TABS.has(rawTab) ? rawTab : "today") as
    | "today"
    | "new"
    | "confirmed"
    | "in_fulfilment"
    | "completed"
    | "cancelled"
    | "all";

  const rawView = getParam(params, "view");
  const view = (VALID_VIEWS.has(rawView) ? rawView : "compact") as "compact" | "detailed";

  const q = getParam(params, "q");
  const paymentStatus = getParam(params, "paymentStatus");
  const fulfilmentMethod = getParam(params, "fulfilment");
  const page = Number(getParam(params, "page") || 1);

  const [orders, tabCounts] = await Promise.all([
    listOrders({ tab, q, paymentStatus, fulfilmentMethod, page }),
    listOrdersTabCounts(),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">
            Orders
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Sales orders</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Operational queue — default view is today&apos;s orders, newest first.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/orders/new">
            <Plus aria-hidden className="mr-2 h-4 w-4" />
            New order
          </Link>
        </Button>
      </header>

      <OrderQueue
        orders={orders}
        tabCounts={tabCounts}
        currentTab={tab}
        currentView={view}
        currentQ={q}
        currentPaymentStatus={paymentStatus}
        currentFulfilment={fulfilmentMethod}
      />
    </div>
  );
}
