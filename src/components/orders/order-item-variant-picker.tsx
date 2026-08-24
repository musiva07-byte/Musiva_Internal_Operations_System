"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBhd } from "@/lib/formatters/currency";
import { cn } from "@/lib/utils";
import type { OrderableVariantItem } from "@/types/app";

type OrderItemVariantPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  variants: OrderableVariantItem[];
  onSelect: (variant: OrderableVariantItem) => void;
};

/**
 * Search + select a variant — used by OrderItemsEditor for both "Change option" (swap an
 * existing line's product/color/size) and "Add item" (a brand-new line). Same product,
 * color/size, stock, and price display pattern as the New Order product picker (sale-wizard),
 * kept single-select since Order Edit changes one line at a time.
 */
export function OrderItemVariantPicker({
  open,
  onOpenChange,
  title,
  description,
  variants,
  onSelect,
}: OrderItemVariantPickerProps) {
  const [search, setSearch] = useState("");

  const filtered = variants.filter((v) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      v.product_name.toLowerCase().includes(q) ||
      v.variant_sku.toLowerCase().includes(q) ||
      v.color.toLowerCase().includes(q) ||
      v.size.toLowerCase().includes(q)
    );
  });

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) setSearch("");
  }

  function handleSelect(variant: OrderableVariantItem) {
    onSelect(variant);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search by name, SKU, colour, or size…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-80 overflow-y-auto rounded-xl border border-[hsl(var(--border))]">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No products found.</p>
          ) : (
            <div className="divide-y divide-[hsl(var(--border))]">
              {filtered.map((v) => {
                const activePrice = v.regular_selling_price_bhd ?? v.selling_price ?? 0;
                const outOfStock = v.stock_quantity <= 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelect(v)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[hsl(var(--secondary))]",
                      outOfStock && "opacity-60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{v.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.color} / {v.size} · SKU: {v.variant_sku}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-musiva-plum">{formatBhd(activePrice)}</p>
                      <p
                        className={cn(
                          "text-xs",
                          outOfStock
                            ? "text-destructive"
                            : v.stock_quantity <= 3
                              ? "text-amber-600"
                              : "text-muted-foreground",
                        )}
                      >
                        {outOfStock ? "Out of stock" : `${v.stock_quantity} in stock`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
