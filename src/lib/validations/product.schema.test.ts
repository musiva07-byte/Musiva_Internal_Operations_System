/**
 * Tests for productVariantSchema's field requirements.
 *
 * variantSku was relaxed from required to optional (blank auto-generates server-side — see
 * resolveEditVariantSku in product.service.ts) so the Edit Product form's "Add variant" flow
 * matches the create wizard's behavior instead of forcing a half-filled placeholder SKU.
 * color/size stay required — a variant genuinely needs both, and this is also the exact
 * validation path that used to fail with zero visible feedback (the Review & Save bug this
 * unit fixes is in the form's error display, not in these requirements).
 */
import { describe, it, expect } from "vitest";
import { productVariantSchema } from "./product.schema";

function baseVariant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    variantSku: "05T-BLA-M",
    barcode: null,
    color: "Black",
    size: "M",
    costPrice: 0,
    sellingPrice: 10,
    discountPrice: null,
    regularSellingPriceBhd: 10,
    discountPriceBhd: null,
    discountStartAt: null,
    discountEndAt: null,
    stockQuantity: 0,
    minimumStock: 1,
    status: "active",
    buyingPriceInr: 0,
    importCostBhd: 0,
    ...overrides,
  };
}

describe("productVariantSchema — variantSku is optional", () => {
  it("accepts a blank variantSku", () => {
    const result = productVariantSchema.safeParse(baseVariant({ variantSku: "" }));
    expect(result.success).toBe(true);
  });

  it("accepts a whitespace-only variantSku (trimmed to empty)", () => {
    const result = productVariantSchema.safeParse(baseVariant({ variantSku: "   " }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variantSku).toBe("");
    }
  });

  it("defaults to an empty string when variantSku is omitted entirely", () => {
    const variant = baseVariant();
    delete (variant as { variantSku?: string }).variantSku;
    const result = productVariantSchema.safeParse(variant);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variantSku).toBe("");
    }
  });

  it("still preserves a staff-typed variantSku exactly (trimmed)", () => {
    const result = productVariantSchema.safeParse(baseVariant({ variantSku: "  CUSTOM-1  " }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variantSku).toBe("CUSTOM-1");
    }
  });
});

describe("productVariantSchema — id accepts a blank string from the hidden form input (regression)", () => {
  // The Edit Product form serializes a new variant's id through
  // <input type="hidden" {...form.register(`variants.${index}.id`)} /> — an HTML input's
  // value is always a string, so an unset id arrives here as "" rather than being absent.
  // Before this fix, z.string().uuid().optional() rejected "" outright (a defined value
  // that isn't a valid UUID), which silently blocked every "Add variant" save in the Edit
  // Product form — the actual root cause behind "Review & Save doesn't work".
  it("accepts an empty string id (new, unsaved variant) and treats it as absent", () => {
    const result = productVariantSchema.safeParse(baseVariant({ id: "" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBeUndefined();
    }
  });

  it("still requires a real id to be a valid UUID when one is present", () => {
    const result = productVariantSchema.safeParse(baseVariant({ id: "not-a-uuid" }));
    expect(result.success).toBe(false);
  });

  it("still accepts a genuine existing variant's UUID id", () => {
    const result = productVariantSchema.safeParse(
      baseVariant({ id: "11111111-1111-4111-8111-111111111111" }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("11111111-1111-4111-8111-111111111111");
    }
  });
});

describe("productVariantSchema — color and size stay required", () => {
  it("rejects a blank color", () => {
    const result = productVariantSchema.safeParse(baseVariant({ color: "" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Color is required.");
    }
  });

  it("rejects a blank size", () => {
    const result = productVariantSchema.safeParse(baseVariant({ size: "" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Size is required.");
    }
  });
});
