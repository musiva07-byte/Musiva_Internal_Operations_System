import Link from "next/link";
import { BarChart3, Boxes, CircleDollarSign, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const reports = [
  {
    title: "Sales reports",
    href: "/admin/reports/sales",
    description: "Revenue, discounts, delivery charges, payment status, and order source.",
    icon: BarChart3,
  },
  {
    title: "Inventory reports",
    href: "/admin/reports/inventory",
    description: "Current stock, stock value, low stock, out of stock, and movement history.",
    icon: Boxes,
  },
  {
    title: "Customer reports",
    href: "/admin/reports/customers",
    description: "New customers, repeat customers, top customers, and purchase history signals.",
    icon: Users,
  },
  {
    title: "Finance reports",
    href: "/admin/reports/finance",
    description: "Revenue, COGS estimate, gross profit, expenses, and estimated net profit.",
    icon: CircleDollarSign,
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Reports</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Business reports</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review boutique performance using server-side filtered operational data.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href}>
              <Card className="h-full shadow-soft transition-colors hover:border-musiva-pink">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{report.title}</CardTitle>
                  <span className="rounded-md bg-musiva-ivory p-2 text-musiva-gold">
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">{report.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
