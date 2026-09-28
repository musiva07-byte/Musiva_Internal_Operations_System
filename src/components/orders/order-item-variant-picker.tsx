"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

export type VariantPickerCurrentItem = {
  productVariantId: string;
  productName: string;
  color: string;
  size: string;
  variantSku: string;
  quantity: number;
  unitPrice: number;
};

type OrderItemVariantPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "change" swaps an existing line's variant — prioritizes the SAME product's other
   *  colors/sizes so staff changing a size can't accidentally pick an unrelated product.
   *  "add" is a brand-new line — no "current" product to prioritize, so it's a plain browse. */
  mode: "change" | "add";
  /** The line item being replaced — only present in "change" mode. Rendered as a fixed
   *  "Current item" summary at the top of the modal, and used to mark the matching row
   *  "Current" (disabled) and to flag other rows that don't have enough stock for this line's
   *  quantity. */
  currentItem?: VariantPickerCurrentItem | null;
  /** Every active variant of currentItem's product (any stock level) — shown first, ahead of
   *  the general browse list, sorted by color then size. Ignored in "add" mode. */
  sameProductVariants: OrderableVariantItem[];
  /** The general/browse list (already excludes out-of-stock by default, capped, most-recently
   *  updated) — the whole picker in "add" mode, or only surfaced once staff types a search term
   *  in "change" mode so they don't stumble onto another product by accident. */
  variants: OrderableVariantItem[];
  onSelect: (variant: OrderableVariantItem) => void;
};

function sortByColorSize(a: OrderableVariantItem, b: OrderableVariantItem) {
  return a.color.localeCompare(b.color) || a.size.localeCompare(b.size);
}

type RowStatus = {
  label: string;
  badgeVariant: "secondary" | "success" | "warning" | "danger";
  disabled: boolean;
};

function rowStatusFor(
  v: OrderableVariantItem,
  currentVariantId: string | undefined,
  requiredQuantity: number,
): RowStatus {
  if (v.id === currentVariantId) {
    return { label: "Current", badgeVariant: "secondary", disabled: true };
  }
  if (v.stock_quantity <= 0) {
    return { label: "Out of stock", badgeVariant: "danger", disabled: true };
  }
  if (v.stock_quantity < requiredQuantity) {
    return { label: "Not enough stock", badgeVariant: "danger", disabled: true };
  }
  if (v.stock_quantity <= 3) {
    return { label: `${v.stock_quantity} in stock`, badgeVariant: "warning", disabled: false };
  }
  return { label: `${v.stock_quantity} in stock`, badgeVariant: "success", disabled: false };
}

/**
 * Search + select a variant — used by OrderItemsEditor for both "Change option" (swap an
 * existing line's product/color/size) and "Add item" (a brand-new line). Same product,
 * color/size, stock, and price display pattern as the New Order product picker (sale-wizard),
 * kept single-select since Order Edit changes one line at a time.
 */
export function OrderItemVariantPicker({
  open,
  onOpenChange,
  mode,
  currentItem,
  sameProductVariants,
  variants,
  onSelect,
}: OrderItemVariantPickerProps) {
  const [search, setSearch] = useState("");
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  const title = mode === "change" ? "Change size / color" : "Add item";
  const description =
    mode === "change"
      ? "Select the correct product option for this order item."
      : "Select the correct product, color, and size.";

  const requiredQuantity = currentItem?.quantity ?? 1;
  const searching = search.trim().length > 0;

  function matchesSearch(v: OrderableVariantItem) {
    if (!searching) return true;
    const q = search.toLowerCase();
    return (
      v.product_name.toLowerCase().includes(q) ||
      v.variant_sku.toLowerCase().includes(q) ||
      v.color.toLowerCase().includes(q) ||
      v.size.toLowerCase().includes(q)
    );
  }

  const sameProductRows = (mode === "change" ? sameProductVariants : [])
    .filter((v) => showOutOfStock || v.stock_quantity > 0 || v.id === currentItem?.productVariantId)
    .filter(matchesSearch)
    .sort(sortByColorSize);
  const sameProductIds = new Set(sameProductRows.map((v) => v.id));

  // In "change" mode, other products only appear once staff actually searches — this is what
  // stops a staff member changing a size from accidentally landing on an unrelated product.
  const otherRows = variants.filter(
    (v) => !sameProductIds.has(v.id) && (mode === "add" || searching) && matchesSearch(v),
  );

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setSearch("");
      setShowOutOfStock(false);
    }
  }

  function handleSelect(variant: OrderableVariantItem, disabled: boolean) {
    if (disabled) return;
    onSelect(variant);
    handleOpenChange(false);
  }

  function renderRow(v: OrderableVariantItem) {
    const activePrice = v.regular_selling_price_bhd ?? v.selling_price ?? 0;
    const status = rowStatusFor(v, currentItem?.productVariantId, requiredQuantity);

    return (
      <button
        key={v.id}
        type="button"
        disabled={status.disabled}
        onClick={() => handleSelect(v, status.disabled)}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
          status.disabled ? "cursor-not-allowed opacity-60" : "hover:bg-[hsl(var(--secondary))]",
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
          <Badge className="mt-1 text-[10px]" variant={status.badgeVariant}>
            {status.label}
          </Badge>
        </div>
      </button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {currentItem && (
          <div className="rounded-md border border-musiva-border bg-musiva-ivory p-3 text-sm">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-musiva-plum">
              Current item
            </p>
            <p className="font-medium text-musiva-ink">{currentItem.productName}</p>
            <p className="text-muted-foreground">
              {currentItem.color} / {currentItem.size} · SKU: {currentItem.variantSku}
            </p>
            <p className="text-muted-foreground">
              Qty {currentItem.quantity} · {formatBhd(currentItem.unitPrice)}
            </p>
          </div>
        )}

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

        {mode === "change" && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-musiva-border"
              checked={showOutOfStock}
              onChange={(e) => setShowOutOfStock(e.target.checked)}
            />
            Show out-of-stock options
          </label>
        )}

        <div className="max-h-80 overflow-y-auto rounded-xl border border-[hsl(var(--border))]">
          {sameProductRows.length === 0 && otherRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No products found.</p>
          ) : (
            <div className="divide-y divide-[hsl(var(--border))]">
              {sameProductRows.length > 0 && (
                <>
                  {mode === "change" && (
                    <p className="bg-musiva-blush/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-musiva-plum">
                      Same product
                    </p>
                  )}
                  {sameProductRows.map(renderRow)}
                </>
              )}
              {otherRows.length > 0 && (
                <>
                  {mode === "change" && (
                    <p className="bg-musiva-blush/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-musiva-plum">
                      Other products
                    </p>
                  )}
                  {otherRows.map(renderRow)}
                </>
              )}
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
