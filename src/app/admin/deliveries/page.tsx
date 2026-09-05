import { DeliveryQueue } from "@/components/deliveries/delivery-queue";
import { PageHeader } from "@/components/layout/page-header";
import { listDeliveries, listDeliveryTabCounts } from "@/lib/services/delivery.service";

type DeliveriesPageProps = {
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
  "pending",
  "packed",
  "ready",
  "out_for_delivery",
  "failed",
  "delivered",
  "all",
]);

const VALID_VIEWS = new Set(["compact", "detailed"]);

export default async function DeliveriesPage({ searchParams }: DeliveriesPageProps) {
  const params = await searchParams;

  const rawTab = getParam(params, "tab");
  const tab = (VALID_TABS.has(rawTab) ? rawTab : "today") as
    | "today"
    | "pending"
    | "packed"
    | "ready"
    | "out_for_delivery"
    | "failed"
    | "delivered"
    | "all";

  const rawView = getParam(params, "view");
  const view = (VALID_VIEWS.has(rawView) ? rawView : "compact") as "compact" | "detailed";

  const q = getParam(params, "q");
  const page = Number(getParam(params, "page") || 1);

  const [deliveries, tabCounts] = await Promise.all([
    listDeliveries({ tab, q, page }),
    listDeliveryTabCounts(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Deliveries"
        title="Delivery queue"
        description="Operational queue — default view is today's deliveries, newest first."
      />

      <DeliveryQueue
        deliveries={deliveries}
        tabCounts={tabCounts}
        currentTab={tab}
        currentView={view}
        currentQ={q}
      />
    </div>
  );
}
