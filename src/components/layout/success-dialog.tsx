"use client";

import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type SuccessStat = { label: string; value: ReactNode };

/**
 * Reusable success confirmation popup for create/update actions that previously just
 * redirected silently (Receive Stock, Correct Quantity, Order status update). Same visual
 * pattern as ProductSaveSuccessDialog / OrderSuccessModal — a checkmark title, an optional
 * label/value stat list, and contextual next-step buttons — factored out so those two extra
 * spots don't each hand-roll their own Dialog boilerplate.
 */
export function SuccessDialog({
  open,
  onOpenChange,
  title,
  description,
  stats,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  stats?: SuccessStat[];
  footer: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-musiva-sage">
            <CheckCircle2 aria-hidden className="h-5 w-5" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {stats && stats.length > 0 && (
          <div className="space-y-2 text-sm">
            {stats.map((stat, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-muted-foreground">{stat.label}</span>
                <span className="font-medium text-foreground">{stat.value}</span>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
