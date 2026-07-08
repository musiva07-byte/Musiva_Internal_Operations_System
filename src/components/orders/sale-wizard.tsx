"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  Loader2,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { customerNameError } from "@/lib/utils/customer-name";
import { OrderSuccessModal, type OrderSuccessSnapshot } from "@/components/orders/order-success-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BAHRAIN_GOVERNORATES, ORDER_SOURCES, PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants";
import { formatBhd } from "@/lib/formatters/currency";
import { titleize } from "@/lib/formatters/labels";
import { formatBahrainPhone } from "@/lib/utils/phone";
import { createOrderAction } from "@/app/admin/orders/actions";
import type { CreateOrderActionResult } from "@/app/admin/orders/actions";
import { searchCustomerAction } from "@/app/admin/orders/customer-search-action";
import type { CustomerAddressRow, CustomerRow, FulfilmentMethod } from "@/types/database";
import type { CustomerSearchResult, OrderableVariantItem } from "@/types/app";
import { cn } from "@/lib/utils";

// ─── types ────────────────────────────────────────────────────────────────────

type SaleWizardProps = {
  variants: OrderableVariantItem[];
  preselectedCustomerId?: string;
};

type WizardStep = 1 | 2 | 3 | 4;

type CartItem = {
  variantId: string;
  productName: string;
  variantSku: string;
  color: string;
  size: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  maxStock: number;
};

type CustomerState =
  | { mode: "searching" }
  | { mode: "found"; customer: CustomerRow; addresses: CustomerAddressRow[] };

// ─── step indicator ───────────────────────────────────────────────────────────

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Customer",
  2: "Items",
  3: "Payment",
  4: "Review",
};

function StepIndicator({ current, highest }: { current: WizardStep; highest: WizardStep }) {
  const steps: WizardStep[] = [1, 2, 3, 4];
  return (
    <nav aria-label="Wizard steps" className="flex items-center gap-1">
      {steps.map((step, idx) => {
        const done = step < current;
        const active = step === current;
        const reachable = step <= highest;
        return (
          <div key={step} className="flex items-center gap-1">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                active && "bg-musiva-plum text-white",
                done && "bg-[hsl(var(--primary-soft))] text-musiva-plum",
                !active && !done && reachable && "border border-[hsl(var(--border))] text-muted-foreground",
                !reachable && "border border-[hsl(var(--border))] text-muted-foreground/40",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : step}
            </span>
            <span
              className={cn(
                "hidden text-xs sm:block",
                active && "font-semibold text-musiva-plum",
                !active && "text-muted-foreground",
              )}
            >
              {STEP_LABELS[step]}
            </span>
            {idx < steps.length - 1 && (
              <ChevronRight className="mx-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ─── step 1: customer ─────────────────────────────────────────────────────────

function CustomerStep({
  customerState,
  setCustomerState,
  mobileInput,
  setMobileInput,
  newCustomerName,
  setNewCustomerName,
}: {
  customerState: CustomerState;
  setCustomerState: (s: CustomerState) => void;
  mobileInput: string;
  setMobileInput: (v: string) => void;
  newCustomerName: string;
  setNewCustomerName: (v: string) => void;
}) {
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.replace(/\D/g, "").length < 8) return;
      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        try {
          const result: CustomerSearchResult = await searchCustomerAction(value);
          if (result) {
            setCustomerState({ mode: "found", customer: result.customer, addresses: result.addresses });
          }
        } finally {
          setSearching(false);
        }
      }, 500);
    },
    [setCustomerState],
  );

  function handleMobileChange(value: string) {
    setMobileInput(value);
    if (customerState.mode !== "searching") {
      setCustomerState({ mode: "searching" });
    }
    triggerSearch(value);
  }

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="mobile-search">Customer mobile number</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter the mobile number to search for an existing customer or register a new one.
        </p>
        <div className="relative mt-2">
          <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="mobile-search"
            type="tel"
            placeholder="+973 XXXX XXXX or 3XXXXXXX"
            value={mobileInput}
            onChange={(e) => handleMobileChange(e.target.value)}
            className="pl-9"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Found existing customer */}
      {customerState.mode === "found" && (
        <div className="rounded-xl border border-[hsl(var(--primary-soft))] bg-[hsl(var(--primary-soft))]/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-musiva-plum text-white">
                <UserCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-musiva-plum">{customerState.customer.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatBahrainPhone(customerState.customer.mobile_normalized)}
                </p>
                {customerState.customer.governorate && (
                  <p className="text-xs text-muted-foreground">{customerState.customer.governorate}</p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setCustomerState({ mode: "searching" });
                setMobileInput("");
              }}
            >
              <X className="mr-1 h-3 w-3" />
              Change
            </Button>
          </div>
        </div>
      )}

      {/* New customer name — shown when no existing customer is matched */}
      {customerState.mode === "searching" && mobileInput.replace(/\D/g, "").length >= 8 && !searching && (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-4">
          <div className="mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">No customer found — register a new one</p>
          </div>
          <div>
            <Label htmlFor="new-name">Full name *</Label>
            <Input
              id="new-name"
              autoComplete="off"
              placeholder="Customer full name"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              className="mt-1"
            />
            {/* Live preview — shown below the input, never replaces it */}
            {newCustomerName.trim().length >= 2 && (
              <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
                <span className="font-medium text-foreground">{newCustomerName.trim()}</span>
                {" "}will be registered as a new customer.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── step 2: items ────────────────────────────────────────────────────────────

function ItemsStep({
  variants,
  cart,
  setCart,
}: {
  variants: OrderableVariantItem[];
  cart: CartItem[];
  setCart: (c: CartItem[]) => void;
}) {
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

  function addToCart(v: OrderableVariantItem) {
    const existing = cart.find((c) => c.variantId === v.id);
    if (existing) {
      if (existing.quantity < v.stock_quantity) {
        setCart(cart.map((c) => (c.variantId === v.id ? { ...c, quantity: c.quantity + 1 } : c)));
      }
      return;
    }
    const activePrice = v.regular_selling_price_bhd ?? v.selling_price ?? 0;
    setCart([
      ...cart,
      {
        variantId: v.id,
        productName: v.product_name,
        variantSku: v.variant_sku,
        color: v.color,
        size: v.size,
        unitPrice: activePrice,
        quantity: 1,
        discount: 0,
        maxStock: v.stock_quantity,
      },
    ]);
  }

  function removeFromCart(variantId: string) {
    setCart(cart.filter((c) => c.variantId !== variantId));
  }

  function updateQuantity(variantId: string, qty: number) {
    setCart(
      cart.map((c) => (c.variantId === variantId ? { ...c, quantity: Math.max(1, Math.min(qty, c.maxStock)) } : c)),
    );
  }

  function updateDiscount(variantId: string, discount: number) {
    setCart(cart.map((c) => (c.variantId === variantId ? { ...c, discount: Math.max(0, discount) } : c)));
  }

  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity - item.discount, 0);

  return (
    <div className="space-y-4">
      {/* Cart summary */}
      {cart.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--primary-soft))] bg-[hsl(var(--primary-soft))]/20 p-4">
          <p className="mb-3 text-sm font-semibold text-musiva-plum">
            Cart — {cart.length} {cart.length === 1 ? "item" : "items"}
          </p>
          <div className="space-y-2">
            {cart.map((item) => (
              <div key={item.variantId} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.color} / {item.size} · {formatBhd(item.unitPrice)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0"
                    onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                  >
                    −
                  </Button>
                  <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0"
                    onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                    disabled={item.quantity >= item.maxStock}
                  >
                    +
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Disc:</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.001}
                    value={item.discount || ""}
                    onChange={(e) => updateDiscount(item.variantId, parseFloat(e.target.value) || 0)}
                    className="h-7 w-20 px-2 text-xs"
                    placeholder="0.000"
                  />
                </div>
                <span className="min-w-[60px] text-right text-sm font-semibold">
                  {formatBhd(Math.max(0, item.unitPrice * item.quantity - item.discount))}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive"
                  onClick={() => removeFromCart(item.variantId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <p className="text-sm font-semibold">
              Subtotal: <span className="text-musiva-plum">{formatBhd(cartSubtotal)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Product search */}
      <div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, SKU, colour, or size…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-xl border border-[hsl(var(--border))]">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No products found.</p>
        ) : (
          <div className="divide-y divide-[hsl(var(--border))]">
            {filtered.map((v) => {
              const inCart = cart.find((c) => c.variantId === v.id);
              const activePrice = v.regular_selling_price_bhd ?? v.selling_price ?? 0;
              const outOfStock = v.stock_quantity <= 0;
              return (
                <div
                  key={v.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    outOfStock && "opacity-50",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{v.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.color} / {v.size} · SKU: {v.variant_sku}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-musiva-plum">{formatBhd(activePrice)}</p>
                      <p
                        className={cn(
                          "text-xs",
                          outOfStock ? "text-destructive" : v.stock_quantity <= 3 ? "text-amber-600" : "text-muted-foreground",
                        )}
                      >
                        {outOfStock ? "Out of stock" : `${v.stock_quantity} in stock`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={inCart ? "secondary" : "outline"}
                      onClick={() => addToCart(v)}
                      disabled={outOfStock}
                      className="h-8 shrink-0"
                    >
                      {inCart ? (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5" /> Added
                        </>
                      ) : (
                        <>
                          <Plus className="mr-1 h-3.5 w-3.5" /> Add
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── step 3: payment & fulfilment ─────────────────────────────────────────────

type PaymentState = {
  fulfilmentMethod: FulfilmentMethod;
  orderSource: string;
  paymentMethod: string;
  paymentStatus: string;
  amountPaid: number;
  deliveryCharge: number;
  deliveryDate: string;
  notes: string;
  // address
  selectedAddressId: string | null;
  newAddress: {
    governorate: string;
    area: string;
    block: string;
    road: string;
    building: string;
    flat: string;
    landmark: string;
    deliveryNotes: string;
  };
};

function PaymentStep({
  state,
  setState,
  addresses,
  cartTotal,
}: {
  state: PaymentState;
  setState: (s: PaymentState) => void;
  addresses: CustomerAddressRow[];
  cartTotal: number;
}) {
  const grandTotal = Math.max(0, cartTotal + (state.fulfilmentMethod === "delivery" ? state.deliveryCharge : 0));
  const isDelivery = state.fulfilmentMethod === "delivery";

  function set(key: keyof PaymentState, value: unknown) {
    setState({ ...state, [key]: value });
  }

  function setAddress(key: keyof PaymentState["newAddress"], value: string) {
    setState({ ...state, newAddress: { ...state.newAddress, [key]: value } });
  }

  const selectedAddress = addresses.find((a) => a.id === state.selectedAddressId);

  return (
    <div className="space-y-6">
      {/* Fulfilment method */}
      <div>
        <Label className="mb-2 block">Fulfilment method</Label>
        <div className="grid grid-cols-3 gap-2">
          {(["walk_in", "customer_pickup", "delivery"] as FulfilmentMethod[]).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => set("fulfilmentMethod", method)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                state.fulfilmentMethod === method
                  ? "border-musiva-plum bg-[hsl(var(--primary-soft))]/30 text-musiva-plum"
                  : "border-[hsl(var(--border))] text-muted-foreground hover:border-musiva-plum/50",
              )}
            >
              {method === "walk_in" ? "Walk-in" : method === "customer_pickup" ? "Pickup" : "Delivery"}
            </button>
          ))}
        </div>
      </div>

      {/* Delivery address — only when delivery is chosen */}
      {isDelivery && (
        <div className="space-y-3">
          <Label className="block">Delivery address</Label>

          {/* Existing addresses */}
          {addresses.length > 0 && (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => set("selectedAddressId", addr.id === state.selectedAddressId ? null : addr.id)}
                  className={cn(
                    "w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                    state.selectedAddressId === addr.id
                      ? "border-musiva-plum bg-[hsl(var(--primary-soft))]/20"
                      : "border-[hsl(var(--border))] hover:border-musiva-plum/50",
                  )}
                >
                  <p className="font-medium">{addr.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[addr.governorate, addr.area, `Block ${addr.block}`, `Road ${addr.road}`, addr.building]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Manual address (if no saved address selected) */}
          {!selectedAddress && (
            <div className="space-y-3 rounded-xl border border-dashed border-[hsl(var(--border))] p-4">
              <p className="text-xs font-medium text-muted-foreground">
                {addresses.length > 0 ? "Or enter a new address" : "Enter delivery address"}
              </p>
              <div>
                <Label htmlFor="del-gov">Governorate *</Label>
                <Select
                  id="del-gov"
                  value={state.newAddress.governorate}
                  onChange={(e) => setAddress("governorate", e.target.value)}
                  className="mt-1"
                >
                  <option value="">Select governorate…</option>
                  {BAHRAIN_GOVERNORATES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="del-area">Area</Label>
                  <Input id="del-area" value={state.newAddress.area} onChange={(e) => setAddress("area", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="del-block">Block</Label>
                  <Input id="del-block" value={state.newAddress.block} onChange={(e) => setAddress("block", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="del-road">Road</Label>
                  <Input id="del-road" value={state.newAddress.road} onChange={(e) => setAddress("road", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="del-building">Building</Label>
                  <Input id="del-building" value={state.newAddress.building} onChange={(e) => setAddress("building", e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <Label htmlFor="del-flat">Flat / Apartment</Label>
                <Input id="del-flat" value={state.newAddress.flat} onChange={(e) => setAddress("flat", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="del-landmark">Landmark</Label>
                <Input id="del-landmark" value={state.newAddress.landmark} onChange={(e) => setAddress("landmark", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="del-notes">Delivery notes</Label>
                <Input id="del-notes" value={state.newAddress.deliveryNotes} onChange={(e) => setAddress("deliveryNotes", e.target.value)} className="mt-1" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="del-date">Delivery date</Label>
              <Input
                id="del-date"
                type="date"
                value={state.deliveryDate}
                onChange={(e) => set("deliveryDate", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="del-charge">Delivery charge (BHD)</Label>
              <Input
                id="del-charge"
                type="number"
                min={0}
                step={0.001}
                value={state.deliveryCharge || ""}
                onChange={(e) => set("deliveryCharge", parseFloat(e.target.value) || 0)}
                className="mt-1"
                placeholder="0.000"
              />
            </div>
          </div>
        </div>
      )}

      {/* Payment */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pay-method">Payment method</Label>
          <Select
            id="pay-method"
            value={state.paymentMethod}
            onChange={(e) => set("paymentMethod", e.target.value)}
            className="mt-1"
          >
            {Object.entries(PAYMENT_METHODS).map(([key, val]) => (
              <option key={key} value={val}>{titleize(val.replace(/_/g, " "))}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pay-status">Payment status</Label>
          <Select
            id="pay-status"
            value={state.paymentStatus}
            onChange={(e) => set("paymentStatus", e.target.value)}
            className="mt-1"
          >
            {Object.entries(PAYMENT_STATUSES).map(([key, val]) => (
              <option key={key} value={val}>{titleize(val)}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="amt-paid">Amount paid (BHD)</Label>
          <Input
            id="amt-paid"
            type="number"
            min={0}
            step={0.001}
            value={state.amountPaid || ""}
            onChange={(e) => set("amountPaid", parseFloat(e.target.value) || 0)}
            className="mt-1"
            placeholder="0.000"
          />
        </div>
        <div>
          <Label htmlFor="order-source">Order source</Label>
          <Select
            id="order-source"
            value={state.orderSource}
            onChange={(e) => set("orderSource", e.target.value)}
            className="mt-1"
          >
            {Object.entries(ORDER_SOURCES).map(([key, val]) => (
              <option key={key} value={val}>{titleize(val.replace(/_/g, " "))}</option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Order notes</Label>
        <Textarea
          id="notes"
          value={state.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Any notes for this order…"
          rows={2}
          className="mt-1"
        />
      </div>

      {/* Total preview */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Items subtotal</span>
          <span>{formatBhd(cartTotal)}</span>
        </div>
        {isDelivery && (
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery charge</span>
            <span>{formatBhd(state.deliveryCharge)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-[hsl(var(--border))] pt-2 text-base font-semibold">
          <span>Total</span>
          <span className="text-musiva-plum">{formatBhd(grandTotal)}</span>
        </div>
        {state.amountPaid > 0 && (
          <div className="mt-1 flex justify-between text-sm text-muted-foreground">
            <span>Amount due</span>
            <span>{formatBhd(Math.max(0, grandTotal - state.amountPaid))}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── step 4: review ───────────────────────────────────────────────────────────

function ReviewStep({
  customerState,
  mobileInput,
  newCustomerName,
  cart,
  payment,
}: {
  customerState: CustomerState;
  mobileInput: string;
  newCustomerName: string;
  cart: CartItem[];
  payment: PaymentState;
}) {
  const cartTotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity - i.discount, 0);
  const isDelivery = payment.fulfilmentMethod === "delivery";
  const grandTotal = Math.max(0, cartTotal + (isDelivery ? payment.deliveryCharge : 0));
  const amountDue = Math.max(0, grandTotal - payment.amountPaid);

  const customerName =
    customerState.mode === "found"
      ? customerState.customer.full_name
      : newCustomerName;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Customer</p>
        <p className="font-semibold">{customerName}</p>
        <p className="text-sm text-muted-foreground">{mobileInput}</p>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Items</p>
        <div className="space-y-2">
          {cart.map((item) => (
            <div key={item.variantId} className="flex justify-between text-sm">
              <span>
                {item.productName} — {item.color}/{item.size} × {item.quantity}
                {item.discount > 0 && <span className="ml-1 text-muted-foreground">(-{formatBhd(item.discount)})</span>}
              </span>
              <span className="font-medium">{formatBhd(Math.max(0, item.unitPrice * item.quantity - item.discount))}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Fulfilment & Payment</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fulfilment</span>
            <span className="capitalize">{payment.fulfilmentMethod.replace(/_/g, " ")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Source</span>
            <span className="capitalize">{payment.orderSource.replace(/_/g, " ")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment</span>
            <span className="capitalize">{payment.paymentMethod.replace(/_/g, " ")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant="outline" className="capitalize">{payment.paymentStatus}</Badge>
          </div>
          {isDelivery && payment.deliveryCharge > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery charge</span>
              <span>{formatBhd(payment.deliveryCharge)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-[hsl(var(--border))] pt-2 font-semibold">
            <span>Grand total</span>
            <span className="text-musiva-plum">{formatBhd(grandTotal)}</span>
          </div>
          {payment.amountPaid > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Paid</span>
              <span>{formatBhd(payment.amountPaid)}</span>
            </div>
          )}
          {amountDue > 0 && (
            <div className="flex justify-between font-medium text-amber-700">
              <span>Amount due</span>
              <span>{formatBhd(amountDue)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── main wizard ──────────────────────────────────────────────────────────────

export function SaleWizard({ variants }: SaleWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<WizardStep>(1);
  const [highestStep, setHighestStep] = useState<WizardStep>(1);
  const [formError, setFormError] = useState<string | null>(null);
  // Success modal — holds the order snapshot shown after creation
  const [successData, setSuccessData] = useState<OrderSuccessSnapshot | null>(null);
  // Double-submission guard: blocks refire while transition is in-flight
  const submittingRef = useRef(false);

  // Step 1 state
  const [mobileInput, setMobileInput] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [customerState, setCustomerState] = useState<CustomerState>({ mode: "searching" });

  // Step 2 state
  const [cart, setCart] = useState<CartItem[]>([]);

  // Step 3 state
  const [payment, setPayment] = useState<PaymentState>({
    fulfilmentMethod: "walk_in",
    orderSource: "whatsapp",
    paymentMethod: "benefitpay",
    paymentStatus: "unpaid",
    amountPaid: 0,
    deliveryCharge: 0,
    deliveryDate: "",
    notes: "",
    selectedAddressId: null,
    newAddress: {
      governorate: "",
      area: "",
      block: "",
      road: "",
      building: "",
      flat: "",
      landmark: "",
      deliveryNotes: "",
    },
  });

  function goToStep(target: WizardStep) {
    setStep(target);
    if (target > highestStep) setHighestStep(target);
  }

  // Validation per step
  function canAdvance(): string | null {
    if (step === 1) {
      if (customerState.mode !== "found") {
        if (mobileInput.replace(/\D/g, "").length < 8) return "Enter a valid mobile number.";
        const nameErr = customerNameError(newCustomerName);
        if (nameErr) return nameErr;
      }
      return null;
    }
    if (step === 2) {
      if (cart.length === 0) return "Add at least one item to the cart.";
      return null;
    }
    if (step === 3) {
      if (payment.fulfilmentMethod === "delivery") {
        const hasAddress = payment.selectedAddressId !== null || payment.newAddress.governorate.trim() !== "";
        if (!hasAddress) return "Select or enter a delivery address.";
      }
      return null;
    }
    return null;
  }

  function handleNext() {
    const err = canAdvance();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    goToStep((step + 1) as WizardStep);
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity - i.discount, 0);
  const addresses = customerState.mode === "found" ? customerState.addresses : [];

  function buildOrderInput() {
    const isNew = customerState.mode !== "found";
    const customerId = customerState.mode === "found" ? customerState.customer.id : undefined;
    const isDelivery = payment.fulfilmentMethod === "delivery";

    const selectedAddress = addresses.find((a) => a.id === payment.selectedAddressId);
    const deliveryAddress = isDelivery
      ? selectedAddress
        ? {
            customerAddressId: selectedAddress.id,
            governorate: selectedAddress.governorate ?? "",
            area: selectedAddress.area ?? undefined,
            block: selectedAddress.block ?? undefined,
            road: selectedAddress.road ?? undefined,
            building: selectedAddress.building ?? undefined,
            flat: selectedAddress.flat ?? undefined,
            landmark: selectedAddress.landmark ?? undefined,
            deliveryNotes: selectedAddress.delivery_notes ?? undefined,
          }
        : {
            customerAddressId: undefined,
            governorate: payment.newAddress.governorate,
            area: payment.newAddress.area || undefined,
            block: payment.newAddress.block || undefined,
            road: payment.newAddress.road || undefined,
            building: payment.newAddress.building || undefined,
            flat: payment.newAddress.flat || undefined,
            landmark: payment.newAddress.landmark || undefined,
            deliveryNotes: payment.newAddress.deliveryNotes || undefined,
          }
      : null;

    const customerData = customerState.mode === "found"
      ? {
          fullName: customerState.customer.full_name,
          mobile: customerState.customer.mobile,
          whatsapp: customerState.customer.whatsapp ?? undefined,
          email: customerState.customer.email ?? undefined,
          governorate: (customerState.customer.governorate as "Capital Governorate" | "Muharraq Governorate" | "Northern Governorate" | "Southern Governorate" | null | undefined) ?? null,
          area: customerState.customer.area ?? undefined,
          block: customerState.customer.block ?? undefined,
          road: customerState.customer.road ?? undefined,
          building: customerState.customer.building ?? undefined,
          flat: customerState.customer.flat ?? undefined,
          landmark: customerState.customer.landmark ?? undefined,
          deliveryNotes: customerState.customer.delivery_notes ?? undefined,
        }
      : {
          fullName: newCustomerName.trim(),
          mobile: mobileInput.trim(),
        };

    return {
      customerId: customerId ?? null,
      customer: customerData,
      fulfilmentMethod: payment.fulfilmentMethod,
      deliveryAddress,
      orderSource: payment.orderSource as "instagram" | "whatsapp" | "website" | "walk_in" | "tiktok" | "referral" | "other",
      orderStatus: "new" as const,
      paymentStatus: payment.paymentStatus as "unpaid" | "paid" | "partial" | "cod" | "refunded",
      paymentMethod: payment.paymentMethod as "cash" | "benefitpay" | "card" | "bank_transfer" | "payment_link" | "cash_on_delivery",
      deliveryDate: payment.deliveryDate || null,
      deliveryTimeSlot: null,
      deliveryCharge: isDelivery ? payment.deliveryCharge : 0,
      amountPaid: payment.amountPaid,
      notes: payment.notes || null,
      paymentReference: null,
      paymentNote: null,
      items: cart.map((item) => ({
        productVariantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
      })),
      isNew,
    };
  }

  function handleSubmit() {
    // Double-submission guard
    if (submittingRef.current || isPending) return;
    submittingRef.current = true;
    setFormError(null);

    startTransition(async () => {
      try {
        const input = buildOrderInput();
        const result: CreateOrderActionResult = await createOrderAction(
          input as Parameters<typeof createOrderAction>[0],
        );

        if (result.ok && result.id) {
          // Resolve customer name from current wizard state
          const customerName =
            customerState.mode === "found"
              ? customerState.customer.full_name
              : newCustomerName.trim();

          setSuccessData({
            id: result.id,
            orderNumber: result.orderNumber,
            customerName,
            customerPhone: mobileInput,
            grandTotal: result.grandTotal,
            paymentStatus: result.paymentStatus,
            fulfilmentMethod: result.fulfilmentMethod,
            deliveryStatus: result.fulfilmentMethod === "delivery" ? "pending" : null,
          });
        } else {
          setFormError(result.error ?? "Order could not be created. Please try again.");
        }
      } finally {
        submittingRef.current = false;
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Success modal — shown after the full transaction succeeds */}
      <OrderSuccessModal
        snapshot={successData}
        onClose={() => setSuccessData(null)}
      />

      {/* Step indicator */}
      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <StepIndicator current={step} highest={highestStep} />
        </CardContent>
      </Card>

      {/* Step content */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-musiva-plum">
            <ShoppingBag className="h-5 w-5" />
            {STEP_LABELS[step]}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <CustomerStep
              customerState={customerState}
              setCustomerState={setCustomerState}
              mobileInput={mobileInput}
              setMobileInput={setMobileInput}
              newCustomerName={newCustomerName}
              setNewCustomerName={setNewCustomerName}
            />
          )}
          {step === 2 && <ItemsStep variants={variants} cart={cart} setCart={setCart} />}
          {step === 3 && (
            <PaymentStep
              state={payment}
              setState={setPayment}
              addresses={addresses}
              cartTotal={cartTotal}
            />
          )}
          {step === 4 && (
            <ReviewStep
              customerState={customerState}
              mobileInput={mobileInput}
              newCustomerName={newCustomerName}
              cart={cart}
              payment={payment}
            />
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {formError && (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{formError}</p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => (step === 1 ? router.back() : setStep((step - 1) as WizardStep))}
          disabled={isPending}
        >
          {step === 1 ? "Cancel" : "Back"}
        </Button>

        <div className="flex gap-2">
          {step < 4 ? (
            <Button type="button" onClick={handleNext} disabled={isPending}>
              Continue
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isPending} className="min-w-[140px]">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save order"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
