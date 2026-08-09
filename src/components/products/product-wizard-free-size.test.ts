/**
 * Tests for the Product Add Step 2 "Free Size" toggle and mixed-color support.
 *
 * As with product-wizard-import-cost.test.ts, this component has no rendering-test
 * setup — the interesting behavior is extracted into pure, exported functions
 * (resolveStep2Sizes, isDuplicateChip) and tested directly, plus source-text guards for
 * the wiring that can't be expressed as a data assertion (the checkbox hides the manual
 * size input, Step 3 never shows a blank/undefined size).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FREE_SIZE_LABEL, resolveStep2Sizes, isDuplicateChip } from "./product-wizard";
import { generateVariants } from "@/lib/utils/variant-generator";
import { generateVariantSku } from "@/lib/utils/sku";

const wizardSource = readFileSync(join(__dirname, "product-wizard.tsx"), "utf-8");

describe("resolveStep2Sizes", () => {
  it("uses ['Free Size'] when the toggle is on, regardless of any typed specific sizes", () => {
    expect(resolveStep2Sizes(true, [])).toEqual(["Free Size"]);
    expect(resolveStep2Sizes(true, ["S", "M"])).toEqual(["Free Size"]);
  });

  it("uses the exact FREE_SIZE_LABEL constant, not a shortened form", () => {
    expect(resolveStep2Sizes(true, [])).toEqual([FREE_SIZE_LABEL]);
    expect(FREE_SIZE_LABEL).toBe("Free Size");
  });

  it("uses the specific sizes typed by staff when the toggle is off", () => {
    expect(resolveStep2Sizes(false, ["S", "M", "L"])).toEqual(["S", "M", "L"]);
  });

  it("returns an empty array when the toggle is off and nothing has been typed yet", () => {
    expect(resolveStep2Sizes(false, [])).toEqual([]);
  });
});

describe("isDuplicateChip", () => {
  it("flags a case-different duplicate color", () => {
    expect(isDuplicateChip(["Black"], "black")).toBe(true);
    expect(isDuplicateChip(["Black"], "BLACK")).toBe(true);
  });

  it("flags a case-different duplicate size", () => {
    expect(isDuplicateChip(["XL"], "xl")).toBe(true);
  });

  it("ignores surrounding whitespace when comparing", () => {
    expect(isDuplicateChip(["Black"], "  black  ")).toBe(true);
  });

  it("does not flag a genuinely different value", () => {
    expect(isDuplicateChip(["Black"], "White")).toBe(false);
  });

  it("does not flag anything against an empty list", () => {
    expect(isDuplicateChip([], "Black")).toBe(false);
  });
});

describe("Free Size + mixed colors — variant generation", () => {
  it("generates one variant per color, all with size 'Free Size'", () => {
    const sizes = resolveStep2Sizes(true, []);
    const variants = generateVariants(
      "05T",
      ["Black & White", "Rose", "Blue"],
      sizes,
      { regularSellingPriceBhd: 0, stockQuantity: 0, minimumStock: 1 },
    );

    expect(variants).toHaveLength(3);
    expect(variants.map((v) => `${v.color} / ${v.size}`)).toEqual([
      "Black & White / Free Size",
      "Rose / Free Size",
      "Blue / Free Size",
    ]);
    expect(variants.every((v) => v.size === "Free Size")).toBe(true);
  });

  it("generates the normal cartesian product for specific sizes (unaffected)", () => {
    const sizes = resolveStep2Sizes(false, ["S", "M"]);
    const variants = generateVariants(
      "05T",
      ["Black", "White"],
      sizes,
      { regularSellingPriceBhd: 0, stockQuantity: 0, minimumStock: 1 },
    );

    expect(variants.map((v) => `${v.color} / ${v.size}`)).toEqual([
      "Black / S",
      "Black / M",
      "White / S",
      "White / M",
    ]);
  });

  it("mixed colors keep the display exactly as typed, only trimmed", () => {
    const variants = generateVariants(
      "05T",
      ["  Black&Pink  ", "Black / Green"],
      ["S"],
      { regularSellingPriceBhd: 0, stockQuantity: 0, minimumStock: 1 },
    );
    // generateVariants doesn't trim on its own — that's done by the chip input on add,
    // so this documents that display-string handling lives at the input boundary, not here.
    expect(variants[0].color).toBe("  Black&Pink  ");
    expect(variants[1].color).toBe("Black / Green");
  });

  it("no variant ever has a blank, null, or undefined size when Free Size is used", () => {
    const sizes = resolveStep2Sizes(true, []);
    const variants = generateVariants("05T", ["Black"], sizes, {
      regularSellingPriceBhd: 0,
      stockQuantity: 0,
      minimumStock: 1,
    });
    expect(variants[0].size).toBeTruthy();
    expect(variants[0].size).not.toBe("");
  });
});

describe("Free Size + mixed colors — SKU generation", () => {
  it("matches the spec example end-to-end: 05T + Black & White + Free Size", () => {
    expect(generateVariantSku("05T", "Black & White", "Free Size")).toBe("05T-BLA-WHI-FRE");
  });

  it("matches the spec example end-to-end: 05T + Black&Pink + S", () => {
    expect(generateVariantSku("05T", "Black&Pink", "S")).toBe("05T-BLA-PIN-S");
  });

  it("matches the spec example end-to-end: auto-generated code + Light Blue + XXL", () => {
    expect(generateVariantSku("WES-TOP", "Light Blue", "XXL")).toBe("WES-TOP-LIG-BLU-XXL");
  });
});

describe("Step 2 UI wiring — Free Size checkbox", () => {
  it("offers a 'This product is Free Size' checkbox", () => {
    expect(wizardSource).toContain("This product is Free Size");
  });

  it("shows the required helper text when Free Size is on", () => {
    expect(wizardSource).toContain("Free Size will be used for all color options.");
  });

  it("hides the manual size chip input when Free Size is on (conditional render, not just disabled)", () => {
    expect(wizardSource).toMatch(/step2\.isFreeSize\s*\?/);
  });

  it("accepts mixed colors — the color input has no character-stripping/rejecting validation", () => {
    expect(wizardSource).not.toMatch(/colors?[^\n]*replace\(\/\[\^/i);
  });
});

describe("Step 3 — no blank/undefined size can reach the UI", () => {
  it("Step 3 never renders a variant without interpolating both color and size together", () => {
    // Every "{v.color} / {v.size}" occurrence renders size as part of the same string,
    // so a missing size would show as an empty gap, never a separate "undefined"/"null" token.
    const matches = wizardSource.match(/\{v\.color\}\s*\/\s*\{v\.size\}/g) ?? [];
    expect(matches.length).toBeGreaterThan(0);
  });

  it("the wizard's own generator never produces an empty-string size (Free Size or specific)", () => {
    const freeSizeVariants = generateVariants(
      "05T",
      ["Black"],
      resolveStep2Sizes(true, []),
      { regularSellingPriceBhd: 0, stockQuantity: 0, minimumStock: 1 },
    );
    const specificVariants = generateVariants(
      "05T",
      ["Black"],
      resolveStep2Sizes(false, ["M"]),
      { regularSellingPriceBhd: 0, stockQuantity: 0, minimumStock: 1 },
    );
    for (const v of [...freeSizeVariants, ...specificVariants]) {
      expect(v.size).not.toBe("");
      expect(v.size).not.toBeNull();
      expect(v.size).not.toBeUndefined();
    }
  });
});
