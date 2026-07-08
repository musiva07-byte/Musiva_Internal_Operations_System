import { describe, expect, it } from "vitest";
import { generateProductSku, generateVariantSku } from "./sku";

describe("generateProductSku", () => {
  it("converts a two-word name", () => {
    // "SATIN" → "SAT", "DRESS" → "DRE"
    expect(generateProductSku("Satin Dress")).toBe("MSV-SAT-DRE");
  });

  it("uses only the first three words", () => {
    // "SILK"→"SIL", "MAXI"→"MAX", "DRESS"→"DRE" (fourth word "Blue" ignored)
    expect(generateProductSku("Silk Maxi Dress Blue")).toBe("MSV-SIL-MAX-DRE");
  });

  it("strips special characters", () => {
    expect(generateProductSku("Floral & Lace Top")).toBe("MSV-FLO-LAC-TOP");
  });

  it("handles a single word", () => {
    expect(generateProductSku("Abaya")).toBe("MSV-ABA");
  });

  it("returns MSV- fallback prefix for blank input", () => {
    const result = generateProductSku("");
    expect(result).toMatch(/^MSV-[A-Z0-9]+$/);
  });

  it("returns MSV- fallback prefix for whitespace-only input", () => {
    const result = generateProductSku("   ");
    expect(result).toMatch(/^MSV-[A-Z0-9]+$/);
  });

  it("uppercases output", () => {
    const result = generateProductSku("satin dress");
    expect(result).toBe("MSV-SAT-DRE");
  });

  it("truncates each word part to 3 characters", () => {
    expect(generateProductSku("Blouse")).toBe("MSV-BLO");
  });
});

describe("generateVariantSku", () => {
  it("appends color and size codes to product SKU", () => {
    // "BLACK" → first 3 chars → "BLA"
    expect(generateVariantSku("MSV-SAT-DRS", "Black", "M")).toBe("MSV-SAT-DRS-BLA-M");
  });

  it("uppercases color code", () => {
    expect(generateVariantSku("MSV-TOP", "beige", "S")).toBe("MSV-TOP-BEI-S");
  });

  it("truncates color code to 3 characters", () => {
    expect(generateVariantSku("MSV-TOP", "RoseGold", "XL")).toBe("MSV-TOP-ROS-XL");
  });

  it("strips non-alphanumeric from color", () => {
    expect(generateVariantSku("MSV-TOP", "Off-White", "M")).toBe("MSV-TOP-OFF-M");
  });

  it("handles numeric size", () => {
    expect(generateVariantSku("MSV-TOP", "Black", "38")).toBe("MSV-TOP-BLA-38");
  });

  it("handles free-text size", () => {
    // "ONESIZE" after stripping space → first 3: "ONE"
    expect(generateVariantSku("MSV-TOP", "Black", "One Size")).toBe("MSV-TOP-BLA-ONE");
  });
});
