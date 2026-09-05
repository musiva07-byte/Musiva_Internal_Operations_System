import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Bottom action bar for long create/edit forms (multi-step wizards, product/order edit forms)
 * so Cancel/Save/Continue stay reachable without scrolling back up. Purely a positioning
 * wrapper — pass the existing button row as children, no handler changes required.
 */
export function StickyActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 rounded-b-lg border-t border-musiva-border bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(90,53,59,0.06)] backdrop-blur supports-[backdrop-filter]:bg-white/80",
        className,
      )}
    >
      {children}
    </div>
  );
}
