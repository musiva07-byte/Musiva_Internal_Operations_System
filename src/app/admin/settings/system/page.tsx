import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Package,
  ShoppingBag,
  Truck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "System — Settings" };

async function getSystemCounts() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const [
    { count: productCount },
    { count: variantCount },
    { count: customerCount },
    { count: orderCount },
    { count: deliveryCount },
    { count: variantsWithoutImages },
    { count: imagelessProducts },
  ] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).neq("status", "archived"),
    supabase.from("product_variants").select("id", { count: "exact", head: true }).neq("status", "archived"),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("deliveries").select("id", { count: "exact", head: true }),
    // Variants with no image at the product level
    supabase
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .neq("status", "archived")
      .not("product_id", "in", `(select product_id from product_images where is_primary = true)`),
    // Products that have no primary image
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .neq("status", "archived")
      .not("id", "in", `(select product_id from product_images where is_primary = true)`),
  ]);

  return {
    productCount: productCount ?? 0,
    variantCount: variantCount ?? 0,
    customerCount: customerCount ?? 0,
    orderCount: orderCount ?? 0,
    deliveryCount: deliveryCount ?? 0,
    variantsWithoutImages: variantsWithoutImages ?? 0,
    imagelessProducts: imagelessProducts ?? 0,
    checkedAt: new Date().toISOString(),
  };
}

const exports = [
  { label: "Products", type: "products", description: "All active products and variants" },
  { label: "Customers", type: "customers", description: "All customer records" },
  { label: "Orders", type: "orders", description: "All orders (last 12 months)" },
  { label: "Stock movements", type: "stock-movements", description: "All inventory changes" },
  { label: "Deliveries", type: "deliveries", description: "All delivery records" },
];

export default async function SystemPage() {
  const counts = await getSystemCounts();

  const metrics = counts
    ? [
        { label: "Active products", value: counts.productCount, icon: Package },
        { label: "Active variants", value: counts.variantCount, icon: Package },
        { label: "Customers", value: counts.customerCount, icon: Users },
        { label: "Total orders", value: counts.orderCount, icon: ShoppingBag },
        { label: "Deliveries", value: counts.deliveryCount, icon: Truck },
      ]
    : [];

  const warnings =
    counts && counts.imagelessProducts > 0
      ? [
          {
            text: `${counts.imagelessProducts} active product${counts.imagelessProducts === 1 ? "" : "s"} have no image. Customers and staff cannot see product photos.`,
          },
        ]
      : [];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">System usage</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Live record counts, data health checks, and emergency data export.
        </p>
      </header>

      {/* Database health */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Database</CardTitle>
            {counts ? (
              <Badge variant="success" className="gap-1.5">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                Connected
              </Badge>
            ) : (
              <Badge variant="danger" className="gap-1.5">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Unavailable
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {counts ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {metrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <div
                      key={metric.label}
                      className="flex flex-col gap-1 rounded-md bg-musiva-ivory p-4"
                    >
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Icon className="h-4 w-4" aria-hidden />
                        <p className="text-xs">{metric.label}</p>
                      </div>
                      <p className="text-2xl font-semibold text-musiva-plum">{metric.value.toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Checked at {new Date(counts.checkedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </>
          ) : (
            <div className="rounded-md border border-musiva-border bg-musiva-ivory p-6">
              <p className="text-sm font-medium text-musiva-plum">Database is unavailable</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                If this is a Supabase Free project, it may have paused due to inactivity. Log in to
                the Supabase dashboard and restore the project to bring it back online.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="border-musiva-warning/40 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-musiva-warning" aria-hidden />
              Data quality warnings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {warnings.map((w) => (
              <div key={w.text} className="flex items-start gap-3 rounded-md bg-musiva-ivory p-3 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-musiva-warning" aria-hidden />
                <p>{w.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Storage note */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Storage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Product images are stored in Supabase Storage. The Supabase Free plan includes{" "}
            <strong className="text-musiva-plum">1 GB</strong> of storage. One image per product is
            enforced.
          </p>
          <p>
            To check storage usage, log in to the{" "}
            <strong>Supabase dashboard → Storage → Bucket usage</strong>.
          </p>
          <p className="text-xs">
            Recommended: keep each product image under 1 MB after compression. Accepted formats:
            WebP, JPEG, PNG. Maximum upload size: 5 MB.
          </p>
        </CardContent>
      </Card>

      {/* Supabase Free plan notice */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Supabase Free plan limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="space-y-1.5 list-disc list-inside">
            <li>500 MB database storage</li>
            <li>1 GB file storage</li>
            <li>5 GB bandwidth per month</li>
            <li>Projects pause after ~7 days of inactivity</li>
            <li>No guaranteed uptime SLA</li>
          </ul>
          <p className="mt-3 text-xs">
            For a small boutique with daily operations, these limits are sufficient. Use the CSV
            exports below as a manual backup routine.
          </p>
        </CardContent>
      </Card>

      {/* CSV Export */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-musiva-plum" aria-hidden />
            Data export (CSV)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Export your business data as CSV files. These are not automatic backups — run them
            periodically as a manual safety measure.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {exports.map((exp) => (
              <div
                key={exp.type}
                className="flex flex-col gap-2 rounded-md border border-musiva-border bg-musiva-ivory p-4"
              >
                <p className="font-medium text-musiva-plum">{exp.label}</p>
                <p className="text-xs text-muted-foreground">{exp.description}</p>
                <Button asChild size="sm" variant="outline" className="mt-auto w-full gap-2">
                  <Link href={`/api/admin/export/${exp.type}`} download>
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Download CSV
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
