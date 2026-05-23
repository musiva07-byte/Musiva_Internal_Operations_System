"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  RefreshCcw,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  Users,
} from "lucide-react";
import { LogoutButton } from "@/components/admin/logout-button";
import { cn } from "@/lib/utils";

const navigationGroups = [
  {
    label: "Daily work",
    items: [
      { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, enabled: true },
      { name: "Orders", href: "/admin/orders", icon: ShoppingBag, enabled: true },
      { name: "Customers", href: "/admin/customers", icon: Users, enabled: true },
      { name: "Deliveries", href: "/admin/deliveries", icon: Truck, enabled: true },
    ],
  },
  {
    label: "Stock",
    items: [
      { name: "Products", href: "/admin/products", icon: Package, enabled: true },
      { name: "Inventory", href: "/admin/inventory", icon: Boxes, enabled: true },
      { name: "Returns & Exchanges", href: "/admin/returns", icon: RefreshCcw, enabled: true },
      { name: "Suppliers", href: "/admin/suppliers", icon: Store, enabled: true },
      { name: "Purchases", href: "/admin/purchases", icon: ShoppingBag, enabled: true },
    ],
  },
  {
    label: "Admin",
    items: [
      { name: "Expenses", href: "/admin/expenses", icon: ReceiptText, enabled: true },
      { name: "Reports", href: "/admin/reports", icon: BarChart3, enabled: true },
      { name: "Staff & Roles", href: "/admin/staff", icon: Users, enabled: true },
      { name: "Settings", href: "/admin/settings", icon: Settings, enabled: true },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col overflow-y-auto border-r bg-musiva-porcelain px-5 py-6 shadow-soft lg:flex">
      <div className="border-b pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-musiva-gold">
          Moosiva
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-musiva-plum">Musiva Lux Wear</h2>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">Internal Operations System</p>
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-5">
        {navigationGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {group.label}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              if (!item.enabled) {
                return (
                  <div
                    key={item.name}
                    className="flex min-h-10 cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/70"
                    title="Planned for a later phase"
                  >
                    <Icon aria-hidden className="h-4 w-4" />
                    <span>{item.name}</span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive || pathname.startsWith(`${item.href}/`)
                      ? "bg-musiva-plum text-primary-foreground"
                      : "text-musiva-ink hover:bg-musiva-ivory hover:text-musiva-plum",
                  )}
                >
                  <Icon aria-hidden className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-3">
        <LogoutButton variant="sidebar" />
        <div className="rounded-md border bg-musiva-ivory p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-musiva-gold">
            Bahrain
          </p>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            Built for BHD, local governorates, boutique staff roles, and future ecommerce readiness.
          </p>
        </div>
      </div>
    </aside>
  );
}
