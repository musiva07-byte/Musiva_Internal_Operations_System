import { describe, expect, it } from "vitest";
import { generateVariants } from "./variant-generator";

const DEFAULTS = { regularSellingPriceBhd: 12.5, stockQuantity: 10, minimumStock: 2 };

describe("generateVariants", () => {
  it("generates color × size cross product", () => {
    const variants = generateVariants("MSV-TOP", ["Black", "Beige"], ["S", "M"], DEFAULTS);
    expect(variants).toHaveLength(4);
  });

  it("preserves color order then size order", () => {
    const variants = generateVariants("MSV-TOP", ["Black", "Beige"], ["S", "M"], DEFAULTS);
    expect(variants[0].color).toBe("Black");
    expect(variants[0].size).toBe("S");
    expect(variants[1].color).toBe("Black");
    expect(variants[1].size).toBe("M");
    expect(variants[2].color).toBe("Beige");
    expect(variants[3].color).toBe("Beige");
  });

  it("assigns selling price from defaults", () => {
    const variants = generateVariants("MSV-TOP", ["Black"], ["M"], DEFAULTS);
    expect(variants[0].regularSellingPriceBhd).toBe(12.5);
    expect(variants[0].sellingPrice).toBe(12.5);
  });

  it("assigns stock quantity from defaults", () => {
    const variants = generateVariants("MSV-TOP", ["Black"], ["M"], DEFAULTS);
    expect(variants[0].stockQuantity).toBe(10);
  });

  it("assigns minimum stock from defaults", () => {
    const variants = generateVariants("MSV-TOP", ["Black"], ["M"], DEFAULTS);
    expect(variants[0].minimumStock).toBe(2);
  });

  it("sets costPrice to 0", () => {
    const variants = generateVariants("MSV-TOP", ["Black"], ["M"], DEFAULTS);
    expect(variants[0].costPrice).toBe(0);
  });

  it("sets discount fields to null", () => {
    const variants = generateVariants("MSV-TOP", ["Black"], ["M"], DEFAULTS);
    expect(variants[0].discountPrice).toBeNull();
    expect(variants[0].discountPriceBhd).toBeNull();
    expect(variants[0].discountStartAt).toBeNull();
    expect(variants[0].discountEndAt).toBeNull();
  });

  it("sets status to active", () => {
    const variants = generateVariants("MSV-TOP", ["Black"], ["M"], DEFAULTS);
    expect(variants[0].status).toBe("active");
  });

  it("generates a variant SKU for each option", () => {
    // "Black" → "BLA" (first 3 chars of "BLACK")
    const variants = generateVariants("MSV-SAT-DRS", ["Black"], ["M"], DEFAULTS);
    expect(variants[0].variantSku).toBe("MSV-SAT-DRS-BLA-M");
  });

  it("returns empty array when no colors", () => {
    expect(generateVariants("MSV-TOP", [], ["S", "M"], DEFAULTS)).toHaveLength(0);
  });

  it("returns empty array when no sizes", () => {
    expect(generateVariants("MSV-TOP", ["Black"], [], DEFAULTS)).toHaveLength(0);
  });

  it("handles single color and single size", () => {
    const variants = generateVariants("MSV-TOP", ["Rose"], ["One Size"], DEFAULTS);
    expect(variants).toHaveLength(1);
    expect(variants[0].color).toBe("Rose");
    expect(variants[0].size).toBe("One Size");
  });
});
