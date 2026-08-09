import { describe, expect, it } from "vitest";
import { generateProductSku, generateVariantSku, resolveUniqueSku } from "./sku";

describe("generateProductSku", () => {
  it("converts a two-word name", () => {
    // "WESTERN" → "WES", "TOP" → "TOP"
    expect(generateProductSku("Western Top")).toBe("WES-TOP");
  });

  it("converts another two-word name", () => {
    expect(generateProductSku("Satin Dress")).toBe("SAT-DRE");
  });

  it("uses only the first three words", () => {
    // "SILK"→"SIL", "MAXI"→"MAX", "DRESS"→"DRE" (fourth word "Blue" ignored)
    expect(generateProductSku("Silk Maxi Dress Blue")).toBe("SIL-MAX-DRE");
  });

  it("strips special characters", () => {
    expect(generateProductSku("Floral & Lace Top")).toBe("FLO-LAC-TOP");
  });

  it("handles a single word", () => {
    expect(generateProductSku("Abaya")).toBe("ABA");
  });

  it("returns a timestamp fallback for blank input", () => {
    const result = generateProductSku("");
    expect(result).toMatch(/^SKU-[A-Z0-9]+$/);
  });

  it("returns a timestamp fallback for whitespace-only input", () => {
    const result = generateProductSku("   ");
    expect(result).toMatch(/^SKU-[A-Z0-9]+$/);
  });

  it("returns a timestamp fallback for a symbols-only input", () => {
    const result = generateProductSku("!!!");
    expect(result).toMatch(/^SKU-[A-Z0-9]+$/);
  });

  it("uppercases output", () => {
    const result = generateProductSku("satin dress");
    expect(result).toBe("SAT-DRE");
  });

  it("truncates each word part to 3 characters", () => {
    expect(generateProductSku("Blouse")).toBe("BLO");
  });
});

describe("generateVariantSku", () => {
  it("matches the spec example: staff-entered product code", () => {
    expect(generateVariantSku("05T", "BLACK", "XL")).toBe("05T-BLA-XL");
  });

  it("matches the spec example: auto-generated product code", () => {
    expect(generateVariantSku("WES-TOP", "Peach", "XXL")).toBe("WES-TOP-PEA-XXL");
  });

  it("appends color and size codes to product SKU", () => {
    expect(generateVariantSku("SAT-DRS", "Black", "M")).toBe("SAT-DRS-BLA-M");
  });

  it("uppercases color code", () => {
    expect(generateVariantSku("TOP", "beige", "S")).toBe("TOP-BEI-S");
  });

  it("truncates color code to 3 characters", () => {
    expect(generateVariantSku("TOP", "RoseGold", "XL")).toBe("TOP-ROS-XL");
  });

  it("strips non-alphanumeric from color", () => {
    expect(generateVariantSku("TOP", "Off-White", "M")).toBe("TOP-OFF-M");
  });

  it("handles numeric size", () => {
    expect(generateVariantSku("TOP", "Black", "38")).toBe("TOP-BLA-38");
  });

  it("handles free-text size", () => {
    expect(generateVariantSku("TOP", "Black", "One Size")).toBe("TOP-BLA-ONE");
  });

  describe("mixed/combined colors", () => {
    it("matches the spec example: 'Black & White' + 'Free Size'", () => {
      expect(generateVariantSku("05T", "Black & White", "Free Size")).toBe("05T-BLA-WHI-FRE");
    });

    it("matches the spec example: 'Black&Pink' (no spaces around the ampersand)", () => {
      expect(generateVariantSku("05T", "Black&Pink", "S")).toBe("05T-BLA-PIN-S");
    });

    it("matches the spec example: auto-generated product code + 'Light Blue'", () => {
      expect(generateVariantSku("WES-TOP", "Light Blue", "XXL")).toBe("WES-TOP-LIG-BLU-XXL");
    });

    it("splits on a slash separator", () => {
      expect(generateVariantSku("TOP", "Black / Green", "M")).toBe("TOP-BLA-GRE-M");
    });

    it("splits a plain two-word color with no separator symbol", () => {
      expect(generateVariantSku("TOP", "Multi Color", "M")).toBe("TOP-MUL-COL-M");
    });

    it("keeps a hyphenated color as a single word (not treated as combined colors)", () => {
      expect(generateVariantSku("TOP", "Off-White", "M")).toBe("TOP-OFF-M");
    });

    it("caps combined colors at 3 word-codes so the SKU stays short", () => {
      expect(generateVariantSku("TOP", "Black White Grey Beige", "M")).toBe("TOP-BLA-WHI-GRE-M");
    });
  });
});

describe("resolveUniqueSku", () => {
  it("returns the base when it is not taken", async () => {
    const result = await resolveUniqueSku("05T-BLA-XL", async () => false);
    expect(result).toBe("05T-BLA-XL");
  });

  it("appends -2 when the base is taken but -2 is free", async () => {
    const taken = new Set(["05T-BLA-XL"]);
    const result = await resolveUniqueSku("05T-BLA-XL", async (candidate) => taken.has(candidate));
    expect(result).toBe("05T-BLA-XL-2");
  });

  it("keeps incrementing the suffix until a free candidate is found", async () => {
    const taken = new Set(["05T-BLA-XL", "05T-BLA-XL-2", "05T-BLA-XL-3"]);
    const result = await resolveUniqueSku("05T-BLA-XL", async (candidate) => taken.has(candidate));
    expect(result).toBe("05T-BLA-XL-4");
  });

  it("returns null when no unique candidate can be found within the safety cap", async () => {
    const result = await resolveUniqueSku("05T-BLA-XL", async () => true);
    expect(result).toBeNull();
  });
});
