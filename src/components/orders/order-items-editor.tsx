"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrderItemVariantPicker } from "@/components/orders/order-item-variant-picker";
import { updateOrderItemsAction } from "@/app/admin/orders/actions";
import { formatBhd } from "@/lib/formatters/currency";
import { titleize } from "@/lib/formatters/labels";
import {
  diffOrderItems,
  computeStockDeltas,
  calculateOrderTotals,
  type ExistingOrderItemLite,
  type IncomingOrderItem,
} from "@/lib/services/order-item-changes";
import type { OrderableVariantItem, OrderWithRelations } from "@/types/app";
import type { OrderItemRow } from "@/types/database";

const FRIENDLY_ERROR = "Could not update order. Please try again or contact the administrator.";

type EditableItem = {
  /** Stable React key: the order_items id for an existing line, or a generated temp id. */
  key: string;
  /** order_items id, or null for a brand-new line. */
  id: string | null;
  productVariantId: string;
  productName: string;
  color: string;
  size: string;
  variantSku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

function toEditableItems(order: { items: OrderItemRow[] }): EditableItem[] {
  return order.items.map((item) => ({
    key: item.id,
    id: item.id,
    productVariantId: item.product_variant_id,
    productName: item.product_name_snapshot,
    color: item.color_snapshot,
    size: item.size_snapshot,
    variantSku: item.variant_sku_snapshot,
    quantity: item.quantity,
    unitPrice: Number(item.unit_price),
    discount: Number(item.discount),
  }));
}

function toIncoming(items: EditableItem[]): IncomingOrderItem[] {
  return items.map((item) => ({
    id: item.id,
    productVariantId: item.productVariantId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount,
  }));
}

function toExisting(items: EditableItem[]): ExistingOrderItemLite[] {
  return items.map((item) => ({
    id: item.id!,
    productVariantId: item.productVariantId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount,
  }));
}

type OrderItemsEditorProps = {
  order: OrderWithRelations;
  variants: OrderableVariantItem[];
  /** True when this order is completed, or its delivery already reached "delivered" — the
   *  stricter owner/manager-only editing case. */
  requiresElevatedPermission: boolean;
  /** Whether the signed-in staff member passes that stricter check. Only consulted when
   *  requiresElevatedPermission is true. */
  canEditElevated: boolean;
};

export function OrderItemsEditor({
  order,
  variants,
  requiresElevatedPermission,
  canEditElevated,
}: OrderItemsEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<EditableItem[]>(() => toEditableItems(order));
  const [note, setNote] = useState("");
  const [pickerFor, setPickerFor] = useState<{ mode: "change" | "add"; key: string | null } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderNumber: string } | null>(null);

  const originalItems = useMemo(() => toEditableItems(order), [order]);
  const variantLabel = useMemo(() => {
    const map = new Map<string, { name: string; color: string; size: string }>();
    for (const item of originalItems) {
      map.set(item.productVariantId, { name: item.productName, color: item.color, size: item.size });
    }
    for (const v of variants) {
      map.set(v.id, { name: v.product_name, color: v.color, size: v.size });
    }
    return map;
  }, [originalItems, variants]);

  const locked = requiresElevatedPermission && !canEditElevated;

  const { diff, stockDeltas, oldTotals, newTotals, hasChanges } = useMemo(() => {
    const d = diffOrderItems(toExisting(originalItems), toIncoming(items));
    const deltas = computeStockDeltas(d);
    const old = calculateOrderTotals(
      originalItems.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount })),
      Number(order.delivery_charge),
    );
    const next = calculateOrderTotals(
      items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount })),
      Number(order.delivery_charge),
    );
    return {
      diff: d,
      stockDeltas: deltas,
      oldTotals: old,
      newTotals: next,
      hasChanges: d.added.length > 0 || d.removed.length > 0 || d.changed.length > 0,
    };
  }, [items, originalItems, order.delivery_charge]);

  const amountPaid = Number(order.amount_paid);
  const newAmountDue = Math.max(0, newTotals.grandTotal - amountPaid);
  const totalDelta = newTotals.grandTotal - oldTotals.grandTotal;

  function labelFor(variantId: string): string {
    const label = variantLabel.get(variantId);
    return label ? `${label.name} — ${label.color} / ${label.size}` : "Product";
  }

  function updateQuantity(key: string, quantity: number) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, quantity: Math.max(1, quantity) } : item)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }

  function openChangePicker(key: string) {
    setPickerFor({ mode: "change", key });
  }

  function openAddPicker() {
    setPickerFor({ mode: "add", key: null });
  }

  function handleVariantSelected(variant: OrderableVariantItem) {
    const activePrice = variant.regular_selling_price_bhd ?? variant.selling_price ?? 0;
    if (pickerFor?.mode === "change" && pickerFor.key) {
      setItems((prev) =>
        prev.map((item) =>
          item.key === pickerFor.key
            ? {
                ...item,
                productVariantId: variant.id,
                productName: variant.product_name,
                color: variant.color,
                size: variant.size,
                variantSku: variant.variant_sku,
                unitPrice: activePrice,
              }
            : item,
        ),
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          key: `new-${variant.id}-${Date.now()}`,
          id: null,
          productVariantId: variant.id,
          productName: variant.product_name,
          color: variant.color,
          size: variant.size,
          variantSku: variant.variant_sku,
          quantity: 1,
          unitPrice: activePrice,
          discount: 0,
        },
      ]);
    }
    setPickerFor(null);
  }

  function handleReviewChanges() {
    setError(null);
    if (items.length === 0) {
      setError("An order must have at least one item.");
      return;
    }
    setConfirmOpen(true);
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await updateOrderItemsAction(order.id, {
        items: toIncoming(items).map((item) => ({
          id: item.id ?? undefined,
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
        })),
        note: note.trim() || undefined,
      });

      if (!result.ok || !result.order) {
        console.error("[OrderItemsEditor] updateOrderItemsAction failed:", result.error);
        setConfirmOpen(false);
        setError(result.error ?? FRIENDLY_ERROR);
        return;
      }

      setConfirmOpen(false);
      setSuccess({ orderNumber: result.order.order_number });
      setItems(toEditableItems(result.order));
      router.refresh();
    });
  }

  if (locked) {
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Order items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 rounded-md border border-musiva-warning/25 bg-musiva-warning/10 p-3 text-sm">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-musiva-warning" />
            <p>
              This order is already completed or delivered. Only an owner or manager can change its
              items.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle>Order items</CardTitle>
        {requiresElevatedPermission && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-musiva-warning/25 bg-musiva-warning/10 p-3 text-sm">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-musiva-warning" />
            <p>This order is already completed. Editing it will update stock history.</p>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-musiva-border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.color} / {item.size} · SKU: {item.variantSku} · {formatBhd(item.unitPrice)} each
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Label htmlFor={`qty-${item.key}`} className="text-xs text-muted-foreground">
                  Qty
                </Label>
                <Input
                  id={`qty-${item.key}`}
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.key, Number(e.target.value) || 1)}
                  className="h-8 w-16 px-2 text-sm"
                />
              </div>
              <p className="min-w-[70px] text-right text-sm font-semibold">
                {formatBhd(Math.max(0, item.unitPrice * item.quantity - item.discount))}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={() => openChangePicker(item.key)}>
                <Pencil aria-hidden className="mr-1.5 h-3.5 w-3.5" />
                Change option
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => removeItem(item.key)}
              >
                <Trash2 aria-hidden className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {items.length === 0 && (
            <p className="rounded-lg border border-dashed border-musiva-border p-4 text-center text-sm text-muted-foreground">
              No items. Add at least one item before saving.
            </p>
          )}
        </div>

        <Button type="button" variant="outline" onClick={openAddPicker}>
          <Plus aria-hidden className="mr-1.5 h-4 w-4" />
          Add item
        </Button>

        <div className="space-y-2">
          <Label htmlFor="order-item-edit-note">Note (optional)</Label>
          <Textarea
            id="order-item-edit-note"
            placeholder="e.g. Customer changed size from XL to XXL"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/20 bg-destructive/5 p-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" disabled={!hasChanges} onClick={handleReviewChanges}>
            Review changes
          </Button>
        </div>
      </CardContent>

      <OrderItemVariantPicker
        open={pickerFor !== null}
        onOpenChange={(open) => !open && setPickerFor(null)}
        title={pickerFor?.mode === "add" ? "Add item" : "Change option"}
        description="Select the correct product, color, and size."
        variants={variants}
        onSelect={handleVariantSelected}
      />

      {/* ── Confirmation popup ─────────────────────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm order changes</DialogTitle>
            <DialogDescription>
              {order.order_number} — {order.customer.full_name} — {titleize(order.order_status)}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-64 space-y-3 overflow-y-auto text-sm">
            {diff.changed.map((c, i) => (
              <div key={`changed-${i}`} className="rounded-md border border-musiva-border p-2.5">
                <p className="text-muted-foreground">
                  Old: {labelFor(c.old.productVariantId)} — qty {c.old.quantity}
                </p>
                <p className="font-medium text-musiva-ink">
                  New: {labelFor(c.new.productVariantId)} — qty {c.new.quantity}
                </p>
              </div>
            ))}
            {diff.removed.map((item, i) => (
              <div key={`removed-${i}`} className="rounded-md border border-musiva-border p-2.5">
                <p className="text-muted-foreground">
                  Old: {labelFor(item.productVariantId)} — qty {item.quantity}
                </p>
                <p className="font-medium text-destructive">New: removed</p>
              </div>
            ))}
            {diff.added.map((item, i) => (
              <div key={`added-${i}`} className="rounded-md border border-musiva-border p-2.5">
                <p className="text-muted-foreground">Old: (none)</p>
                <p className="font-medium text-musiva-ink">
                  New: {labelFor(item.productVariantId)} — qty {item.quantity}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-1 rounded-md border border-musiva-border bg-musiva-ivory p-3 text-sm">
            <p className="mb-1 font-semibold text-musiva-plum">Stock impact</p>
            {stockDeltas.size === 0 ? (
              <p className="text-muted-foreground">No stock change.</p>
            ) : (
              [...stockDeltas.entries()].map(([variantId, delta]) => (
                <p key={variantId}>
                  {labelFor(variantId)}:{" "}
                  <span className={delta > 0 ? "text-musiva-sage" : "text-destructive"}>
                    {delta > 0 ? `returned +${delta}` : `deducted ${delta}`}
                  </span>
                </p>
              ))
            )}
          </div>

          <div className="space-y-1 rounded-md border border-musiva-border p-3 text-sm">
            <p className="mb-1 font-semibold text-musiva-plum">Totals impact</p>
            <Row label="Old total" value={formatBhd(oldTotals.grandTotal)} />
            <Row label="New total" value={formatBhd(newTotals.grandTotal)} />
            <Row label="Amount paid" value={formatBhd(amountPaid)} />
            <Row label="New amount due" value={formatBhd(newAmountDue)} />
            {totalDelta > 0 && (
              <p className="mt-1 font-medium text-musiva-warning">
                Additional amount due: {formatBhd(totalDelta)}
              </p>
            )}
            {totalDelta < 0 && (
              <p className="mt-1 font-medium text-musiva-sage">
                Possible refund/credit: {formatBhd(Math.abs(totalDelta))}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Back to edit
            </Button>
            <Button type="button" disabled={isPending} onClick={handleConfirm}>
              {isPending ? "Saving..." : "Confirm changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Success popup ──────────────────────────────────────────────────────── */}
      <Dialog open={success !== null} onOpenChange={(open) => !open && setSuccess(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 aria-hidden className="h-5 w-5 text-musiva-sage" />
              <DialogTitle>Order updated successfully</DialogTitle>
            </div>
            <DialogDescription>Stock has been adjusted.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button type="button" onClick={() => router.push(`/admin/orders/${order.id}`)}>
              View order
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(`/print/invoice/${order.id}`, "_blank", "noopener,noreferrer")}
            >
              Print updated receipt
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/admin/orders")}>
              Back to orders
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-musiva-ink">{value}</span>
    </div>
  );
}
