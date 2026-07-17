import type { Metadata } from "next";
import { WebsiteRequestQueue } from "@/components/website-requests/website-request-queue";
import { listWebsiteRequestTabCounts, listWebsiteRequests } from "@/lib/services/website-request.service";

export const metadata: Metadata = {
  title: "Website Requests",
};

type WebsiteRequestsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

const VALID_TABS = new Set(["new", "contacted", "confirmed", "cancelled", "all"]);

export default async function WebsiteRequestsPage({ searchParams }: WebsiteRequestsPageProps) {
  const params = await searchParams;

  const rawTab = getParam(params, "tab");
  const tab = (VALID_TABS.has(rawTab) ? rawTab : "new") as
    | "new"
    | "contacted"
    | "confirmed"
    | "cancelled"
    | "all";

  const q = getParam(params, "q");
  const page = Number(getParam(params, "page") || 1);

  const [requests, tabCounts] = await Promise.all([
    listWebsiteRequests({ tab, q, page }),
    listWebsiteRequestTabCounts(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">
          Website Requests
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Website order requests</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Checkout requests from www.moosivabh.com, newest first. These are pending requests —
          confirming one here does not create an order or deduct stock.
        </p>
      </header>

      <WebsiteRequestQueue
        requests={requests}
        tabCounts={tabCounts}
        currentTab={tab}
        currentQ={q}
      />
    </div>
  );
}
