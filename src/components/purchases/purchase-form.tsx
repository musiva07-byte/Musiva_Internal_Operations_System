"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Info, Plus, Trash2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createPurchaseAction } from "@/app/admin/purchases/actions";
import { PURCHASE_PAYMENT_STATUSES, PURCHASE_STATUSES } from "@/lib/constants";
import { formatBhd, formatSupplierCurrency } from "@/lib/formatters/currency";
import { titleize } from "@/lib/formatters/labels";
import {
  allocateImportCostProportional,
  calculateLandedUnitCost,
  round3,
  sumImportCosts,
  supplierAmountToBhd,
} from "@/lib/pricing/calculations";
import { purchaseSchema, type PurchaseInput } from "@/lib/validations/purchase.schema";
import type { PurchasableVariantItem } from "@/types/app";
import type { SupplierRow } from "@/types/database";

type PurchaseFormProps = {
  suppliers: SupplierRow[];
  variants: PurchasableVariantItem[];
};

const defaultItem = {
  productVariantId: "",
  quantityOrdered: 1,
  quantityReceived: 0,
  supplierUnitCost: 0,
  supplierCurrency: "INR",
  convertedUnitCostBhd: 0,
  allocatedImportCostBhd: 0,
  landedUnitCostBhd: 0,
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function PurchaseForm({ suppliers, variants }: PurchaseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<PurchaseInput>({
    resolver: zodResolver(purchaseSchema) as Resolver<PurchaseInput>,
    defaultValues: {
      supplierId: "",
      purchaseDate: todayInputValue(),
      expectedArrivalDate: null,
      status: PURCHASE_STATUSES.ordered,
      paymentStatus: PURCHASE_PAYMENT_STATUSES.unpaid,
      purchaseCurrency: "INR",
      exchangeRateToBhd: 100,
      exchangeRateDate: todayInputValue(),
      exchangeRateSource: "manual",
      discount: 0,
      shippingCostBhd: 0,
      customsCostBhd: 0,
      bankFeeBhd: 0,
      packagingCostBhd: 0,
      otherImportCostBhd: 0,
      notes: null,
      items: [defaultItem],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const watchedItems = useWatch({ control: form.control, name: "items" });
  const exchangeRate = useWatch({ control: form.control, name: "exchangeRateToBhd" });
  const purchaseCurrency = useWatch({ control: form.control, name: "purchaseCurrency" });
  const discount = useWatch({ control: form.control, name: "discount" });
  const shippingCostBhd = useWatch({ control: form.control, name: "shippingCostBhd" });
  const customsCostBhd = useWatch({ control: form.control, name: "customsCostBhd" });
  const bankFeeBhd = useWatch({ control: form.control, name: "bankFeeBhd" });
  const packagingCostBhd = useWatch({ control: form.control, name: "packagingCostBhd" });
  const otherImportCostBhd = useWatch({ control: form.control, name: "otherImportCostBhd" });

  // Re-calculate all derived values whenever inputs change
  const calc = useMemo(() => {
    const rate = Number(exchangeRate) || 0;
    const importCostTotal = sumImportCosts({
      shippingCostBhd: Number(shippingCostBhd) || 0,
      customsCostBhd: Number(customsCostBhd) || 0,
      bankFeeBhd: Number(bankFeeBhd) || 0,
      packagingCostBhd: Number(packagingCostBhd) || 0,
      otherImportCostBhd: Number(otherImportCostBhd) || 0,
    });

    const itemCalcs = (watchedItems ?? []).map((item) => {
      const qty = Number(item.quantityOrdered) || 0;
      const supplierCost = Number(item.supplierUnitCost) || 0;
      const converted = rate > 0 ? supplierAmountToBhd(supplierCost, rate) : 0;
      return { qty, supplierCost, converted, lineConverted: round3(converted * qty) };
    });

    const totalConverted = itemCalcs.reduce((s, i) => s + i.lineConverted, 0);

    const items = itemCalcs.map((i) => {
      const allocated = allocateImportCostProportional(i.lineConverted, totalConverted, importCostTotal);
      const allocatedPerUnit = i.qty > 0 ? round3(allocated / i.qty) : 0;
      const landed = calculateLandedUnitCost(i.converted, allocatedPerUnit);
      return { ...i, allocatedPerUnit, landed, lineLanded: round3(landed * i.qty) };
    });

    const subtotal = totalConverted;
    const grandTotal = Math.max(0, subtotal - Number(discount || 0) + importCostTotal);

    return { items, subtotal, importCostTotal, grandTotal };
  }, [watchedItems, exchangeRate, shippingCostBhd, customsCostBhd, bankFeeBhd, packagingCostBhd, otherImportCostBhd, discount]);

  function onSubmit(values: PurchaseInput) {
    // Inject calculated values before sending to server
    const enriched: PurchaseInput = {
      ...values,
      items: values.items.map((item, i) => {
        const c = calc.items[i];
        return {
          ...item,
          convertedUnitCostBhd: c?.converted ?? 0,
          allocatedImportCostBhd: c?.allocatedPerUnit ?? 0,
          landedUnitCostBhd: c?.landed ?? 0,
        };
      }),
    };

    setFormError(null);
    startTransition(async () => {
      const result = await createPurchaseAction(enriched);
      if (!result.ok || !result.id) {
        setFormError(result.error ?? "Purchase could not be created.");
        return;
      }
      router.push(`/admin/purchases/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      {/* ── Purchase details ─────────────────────────────────────── */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Purchase details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Supplier">
            <Select {...form.register("supplierId")}>
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.supplier_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Purchase date">
            <Input type="date" {...form.register("purchaseDate")} />
          </Field>
          <Field label="Expected arrival">
            <Input type="date" {...form.register("expectedArrivalDate")} />
          </Field>
          <Field label="Status">
            <Select {...form.register("status")}>
              {[PURCHASE_STATUSES.draft, PURCHASE_STATUSES.ordered, PURCHASE_STATUSES.inTransit].map(
                (s) => (
                  <option key={s} value={s}>
                    {titleize(s)}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field label="Payment status">
            <Select {...form.register("paymentStatus")}>
              {Object.values(PURCHASE_PAYMENT_STATUSES).map((s) => (
                <option key={s} value={s}>
                  {titleize(s)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea {...form.register("notes")} />
          </div>
        </CardContent>
      </Card>

      {/* ── Exchange rate ─────────────────────────────────────────── */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Exchange rate</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the actual bank or money-transfer rate. This rate is saved with the purchase and
            will not change when future rates are updated.
          </p>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <Field label="Supplier currency">
            <Select {...form.register("purchaseCurrency")}>
              <option value="INR">INR – Indian Rupee</option>
              <option value="USD">USD – US Dollar</option>
              <option value="EUR">EUR – Euro</option>
              <option value="GBP">GBP – British Pound</option>
              <option value="AED">AED – UAE Dirham</option>
            </Select>
          </Field>
          <Field
            label={`Exchange rate (${purchaseCurrency} per 1 BHD)`}
            hint="How many supplier-currency units equal 1 BHD"
          >
            <Input
              min={0}
              step="0.01"
              type="number"
              {...form.register("exchangeRateToBhd")}
            />
          </Field>
          <Field label="Rate date">
            <Input type="date" {...form.register("exchangeRateDate")} />
          </Field>
        </CardContent>
      </Card>

      {/* ── Import costs ─────────────────────────────────────────── */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Import costs</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            All amounts in BHD. These are allocated across items proportionally by converted value.
          </p>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <Field label="Shipping (BHD)">
            <Input min={0} step="0.001" type="number" {...form.register("shippingCostBhd")} />
          </Field>
          <Field label="Customs (BHD)">
            <Input min={0} step="0.001" type="number" {...form.register("customsCostBhd")} />
          </Field>
          <Field label="Bank fee (BHD)">
            <Input min={0} step="0.001" type="number" {...form.register("bankFeeBhd")} />
          </Field>
          <Field label="Packaging (BHD)">
            <Input min={0} step="0.001" type="number" {...form.register("packagingCostBhd")} />
          </Field>
          <Field label="Other costs (BHD)">
            <Input min={0} step="0.001" type="number" {...form.register("otherImportCostBhd")} />
          </Field>
          <Field label="Purchase discount (BHD)">
            <Input min={0} step="0.001" type="number" {...form.register("discount")} />
          </Field>
        </CardContent>
      </Card>

      {/* ── Items + cost calculator ───────────────────────────────── */}
      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Items</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter supplier prices in {purchaseCurrency}. Landed costs are calculated live below.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => append(defaultItem)}>
            <Plus aria-hidden className="mr-2 h-4 w-4" />
            Add item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => {
            const c = calc.items[index];
            return (
              <div
                key={field.id}
                className="rounded-md border bg-musiva-ivory p-4 space-y-4"
              >
                <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                  <div className="space-y-2">
                    <Label>Product variant</Label>
                    <Select {...form.register(`items.${index}.productVariantId`)}>
                      <option value="">Select variant</option>
                      {variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.product_name} — {v.color}/{v.size} — {v.variant_sku}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Field label="Ordered qty">
                    <Input min={1} type="number" {...form.register(`items.${index}.quantityOrdered`)} />
                  </Field>
                  <Field label="Received qty">
                    <Input min={0} type="number" {...form.register(`items.${index}.quantityReceived`)} />
                  </Field>
                  <Field label={`Supplier price (${purchaseCurrency})`}>
                    <Input
                      min={0}
                      step="0.01"
                      type="number"
                      {...form.register(`items.${index}.supplierUnitCost`)}
                    />
                  </Field>
                  <div className="flex items-end">
                    <Button
                      disabled={fields.length === 1}
                      size="icon"
                      type="button"
                      variant="outline"
                      onClick={() => remove(index)}
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Cost calculator preview */}
                {c && (
                  <div className="grid grid-cols-2 gap-2 rounded-md border border-musiva-border bg-white p-3 text-xs md:grid-cols-4">
                    <CostPreviewCell
                      label={`Supplier price (${purchaseCurrency})`}
                      value={formatSupplierCurrency(c.supplierCost, purchaseCurrency)}
                    />
                    <CostPreviewCell
                      label="Converted (BHD)"
                      value={formatBhd(c.converted)}
                    />
                    <CostPreviewCell
                      label="Allocated import / unit"
                      value={formatBhd(c.allocatedPerUnit)}
                    />
                    <CostPreviewCell
                      label="Landed unit cost"
                      value={formatBhd(c.landed)}
                      highlight
                    />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Order totals ─────────────────────────────────────────── */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Order totals</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
          <TotalCell label="Converted subtotal" value={formatBhd(calc.subtotal)} />
          <TotalCell label="Total import costs" value={formatBhd(calc.importCostTotal)} />
          <TotalCell label="Discount" value={`- ${formatBhd(Number(discount) || 0)}`} />
          <TotalCell label="Grand total" value={formatBhd(calc.grandTotal)} highlight />
        </CardContent>
      </Card>

      {/* ── Rate note ────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 rounded-md border border-musiva-border bg-musiva-ivory p-4 text-sm text-muted-foreground">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-musiva-gold" />
        <p>
          The exchange rate entered above will be saved permanently with this purchase order.
          Historical costs will not change if the exchange rate is updated later.
        </p>
      </div>

      {formError ? (
        <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save purchase"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function CostPreviewCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p
        className={
          highlight
            ? "mt-0.5 font-semibold text-musiva-plum"
            : "mt-0.5 font-medium text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

function TotalCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex justify-between rounded-md p-3 ${highlight ? "bg-musiva-mauve-soft/30" : "bg-musiva-ivory"}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          highlight ? "font-semibold text-musiva-plum" : "font-medium text-musiva-plum"
        }
      >
        {value}
      </span>
    </div>
  );
}
