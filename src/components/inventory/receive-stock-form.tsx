"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImageOff, PackagePlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addStockAction } from "@/app/admin/inventory/actions";
import {
  RECEIVE_STOCK_REASON_LABELS,
  RECEIVE_STOCK_REASONS,
  reasonToMovementType,
  type ReceiveStockReason,
} from "@/lib/utils/stock-reason";
import { formatBhd } from "@/lib/formatters/currency";
import type { InventoryVariantItem } from "@/types/app";

type ReceiveStockFormProps = {
  variants: InventoryVariantItem[];
};

type GroupedProduct = {
  productName: string;
  productSku: string;
  primaryImageUrl: string | null;
  variants: InventoryVariantItem[];
};

function groupByProduct(variants: InventoryVariantItem[]): GroupedProduct[] {
  const map = new Map<string, GroupedProduct>();

  for (const v of variants) {
    const key = v.product_sku;
    if (!map.has(key)) {
      map.set(key, {
        productName: v.product_name,
        productSku: v.product_sku,
        primaryImageUrl: v.primary_image_url,
        variants: [],
      });
    }
    map.get(key)!.variants.push(v);
  }

  return Array.from(map.values()).sort((a, b) =>
    a.productName.localeCompare(b.productName),
  );
}

export function ReceiveStockForm({ variants }: ReceiveStockFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedProductSku, setSelectedProductSku] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<ReceiveStockReason>(
    RECEIVE_STOCK_REASONS.supplierDelivery,
  );
  const [note, setNote] = useState("");

  const products = useMemo(() => groupByProduct(variants), [variants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        p.productSku.toLowerCase().includes(q) ||
        p.variants.some(
          (v) =>
            v.color.toLowerCase().includes(q) ||
            v.size.toLowerCase().includes(q) ||
            v.variant_sku.toLowerCase().includes(q),
        ),
    );
  }, [products, search]);

  const selectedProduct = products.find((p) => p.productSku === selectedProductSku) ?? null;
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null;
  const projectedStock =
    selectedVariant !== null ? selectedVariant.stock_quantity + quantity : null;

  function selectProduct(product: GroupedProduct) {
    setSelectedProductSku(product.productSku);
    setSelectedVariantId("");
    setSearch(product.productName);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVariantId) {
      setFormError("Please select a color and size option.");
      return;
    }
    if (!quantity || quantity < 1) {
      setFormError("Quantity received must be at least 1.");
      return;
    }

    setFormError(null);
    startTransition(async () => {
      const result = await addStockAction({
        productVariantId: selectedVariantId,
        quantity,
        movementType: reasonToMovementType(reason),
        referenceType: null,
        referenceId: null,
        note: note.trim() || null,
      });

      if (!result.ok) {
        setFormError(result.error ?? "Stock could not be added. Please try again.");
        return;
      }

      router.push("/admin/inventory");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Step 1: Search */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>1. Find product</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Search by product name, SKU, color or size…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedProductSku("");
                  setSelectedVariantId("");
                }}
              />
            </div>

            {search.trim() && !selectedProductSku && (
              <div className="max-h-64 overflow-y-auto rounded-md border bg-white shadow-soft">
                {filtered.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No products match your search.</p>
                ) : (
                  filtered.map((product) => (
                    <button
                      key={product.productSku}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-musiva-ivory"
                      type="button"
                      onClick={() => selectProduct(product)}
                    >
                      {product.primaryImageUrl ? (
                        <div className="relative h-10 w-8 shrink-0 overflow-hidden rounded">
                          <Image
                            alt={product.productName}
                            className="object-cover object-top"
                            fill
                            sizes="32px"
                            src={product.primaryImageUrl}
                          />
                        </div>
                      ) : (
                        <div className="flex h-10 w-8 shrink-0 items-center justify-center rounded bg-musiva-blush">
                          <ImageOff aria-hidden className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-musiva-plum">{product.productName}</p>
                        <p className="text-xs text-muted-foreground">{product.productSku}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {selectedProduct && (
              <div className="flex items-center gap-4 rounded-md border border-musiva-border bg-musiva-ivory p-4">
                {selectedProduct.primaryImageUrl ? (
                  <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded">
                    <Image
                      alt={selectedProduct.productName}
                      className="object-cover object-top"
                      fill
                      sizes="48px"
                      src={selectedProduct.primaryImageUrl}
                    />
                  </div>
                ) : (
                  <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-musiva-blush">
                    <ImageOff aria-hidden className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-musiva-plum">{selectedProduct.productName}</p>
                  <p className="text-sm text-muted-foreground">{selectedProduct.productSku}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedProduct.variants.length} size/color option
                    {selectedProduct.variants.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Select color/size */}
        {selectedProduct && (
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>2. Select color and size</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {selectedProduct.variants.map((variant) => (
                  <button
                    key={variant.id}
                    className={
                      selectedVariantId === variant.id
                        ? "rounded-md border-2 border-musiva-plum bg-musiva-sidebar-active px-3 py-3 text-left transition-colors"
                        : "rounded-md border border-musiva-border bg-white px-3 py-3 text-left transition-colors hover:border-musiva-champagne hover:bg-musiva-ivory"
                    }
                    type="button"
                    onClick={() => setSelectedVariantId(variant.id)}
                  >
                    <p className="text-sm font-medium text-musiva-plum">
                      {variant.color} / {variant.size}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Stock: {variant.stock_quantity}
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Quantity, reason, note */}
        {selectedVariantId && (
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>3. Enter quantity received</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity received</Label>
                <Input
                  id="quantity"
                  min={1}
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Select
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ReceiveStockReason)}
                >
                  {Object.entries(RECEIVE_STOCK_REASON_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Textarea
                  id="note"
                  placeholder="e.g. Received from supplier on 5 Jul 2026"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {formError ? (
          <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button disabled={isPending || !selectedVariantId} type="submit">
            <PackagePlus aria-hidden className="mr-2 h-4 w-4" />
            {isPending
              ? "Adding…"
              : quantity > 0 && selectedVariantId
              ? `Add ${quantity} unit${quantity !== 1 ? "s" : ""}`
              : "Add stock"}
          </Button>
        </div>
      </form>

      {/* Preview panel */}
      <div className="space-y-4">
        {selectedVariant ? (
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Stock preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-musiva-ivory p-4 text-center">
                  <p className="text-xs text-muted-foreground">Current stock</p>
                  <p className="mt-1 text-3xl font-semibold text-musiva-plum">
                    {selectedVariant.stock_quantity}
                  </p>
                </div>
                <div className="rounded-md bg-musiva-ivory p-4 text-center">
                  <p className="text-xs text-muted-foreground">After adding</p>
                  <p className="mt-1 text-3xl font-semibold text-musiva-plum">
                    {projectedStock}
                  </p>
                </div>
              </div>
              <div className="space-y-2 border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Product</span>
                  <span className="font-medium">{selectedVariant.product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Option</span>
                  <span>{selectedVariant.color} / {selectedVariant.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Low-stock alert at</span>
                  <span>{selectedVariant.minimum_stock} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Selling price</span>
                  <span>{formatBhd(selectedVariant.regular_selling_price_bhd ?? selectedVariant.selling_price)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-soft">
            <CardContent className="flex h-48 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <PackagePlus aria-hidden className="h-8 w-8 opacity-40" />
              <p className="text-sm">
                Select a product and size/color option to see a stock preview before saving.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-soft">
          <CardContent className="pt-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-musiva-gold">
              How this works
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Every stock addition is recorded in history.</li>
              <li>For supplier deliveries, use the Purchases workflow to also capture cost details.</li>
              <li>You can correct stock quantities from Stock Management.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
