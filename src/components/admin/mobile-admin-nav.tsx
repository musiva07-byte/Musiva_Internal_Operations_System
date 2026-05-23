"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigationGroups } from "@/components/admin/admin-sidebar";
import { cn } from "@/lib/utils";

export function MobileAdminNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setIsOpen((current) => !current)}
        size="icon"
        type="button"
        variant="outline"
      >
        {isOpen ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
      </Button>

      <div
        className={cn(
          "fixed inset-x-0 top-[73px] z-50 max-h-[calc(100vh-73px)] overflow-y-auto border-b bg-musiva-porcelain px-4 py-5 shadow-soft",
          isOpen ? "block" : "hidden",
        )}
      >
        <nav className="grid gap-5">
          {navigationGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.name}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-musiva-plum text-primary-foreground"
                        : "text-musiva-ink hover:bg-musiva-ivory hover:text-musiva-plum",
                    )}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                  >
                    <Icon aria-hidden className="h-4 w-4 shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
