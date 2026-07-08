import { describe, expect, it } from "vitest";
import { normalizeBahrainPhone, formatBahrainPhone, isSameBahrainPhone } from "./phone";

describe("normalizeBahrainPhone", () => {
  // ── 8-digit local numbers ────────────────────────────────────────────────
  it("normalizes 8-digit local number", () => {
    expect(normalizeBahrainPhone("33331101")).toBe("97333331101");
  });

  it("normalizes 8-digit local starting with 3", () => {
    expect(normalizeBahrainPhone("36001234")).toBe("97336001234");
  });

  // ── E.164 with + ─────────────────────────────────────────────────────────
  it("normalizes E.164 with +", () => {
    expect(normalizeBahrainPhone("+97333331101")).toBe("97333331101");
  });

  it("normalizes E.164 with + and spaces", () => {
    expect(normalizeBahrainPhone("+973 3333 1101")).toBe("97333331101");
  });

  it("normalizes E.164 with + and dashes", () => {
    expect(normalizeBahrainPhone("+973-3333-1101")).toBe("97333331101");
  });

  // ── 00 international prefix ───────────────────────────────────────────────
  it("normalizes 00973 prefix", () => {
    expect(normalizeBahrainPhone("00973 3333 1101")).toBe("97333331101");
  });

  it("normalizes 0097333331101 (no spaces)", () => {
    expect(normalizeBahrainPhone("0097333331101")).toBe("97333331101");
  });

  // ── Already-normalized form ───────────────────────────────────────────────
  it("accepts already-normalized 97333331101", () => {
    expect(normalizeBahrainPhone("97333331101")).toBe("97333331101");
  });

  // ── Invalid inputs ────────────────────────────────────────────────────────
  it("returns null for empty string", () => {
    expect(normalizeBahrainPhone("")).toBeNull();
  });

  it("returns null for too-short number", () => {
    expect(normalizeBahrainPhone("1234")).toBeNull();
  });

  it("returns null for 9-digit number", () => {
    expect(normalizeBahrainPhone("123456789")).toBeNull();
  });

  it("returns null for non-Bahrain country code", () => {
    expect(normalizeBahrainPhone("+966501234567")).toBeNull();
  });

  it("returns null for letters", () => {
    expect(normalizeBahrainPhone("abcdefgh")).toBeNull();
  });

  // ── Different formats of the same number resolve identically ─────────────
  it("resolves same number regardless of format", () => {
    const formats = [
      "33331101",
      "+97333331101",
      "+973 3333 1101",
      "00973 3333 1101",
    ];
    const normalized = formats.map(normalizeBahrainPhone);
    const unique = new Set(normalized.filter(Boolean));
    expect(unique.size).toBe(1);
  });
});

describe("formatBahrainPhone", () => {
  it("formats normalized number", () => {
    expect(formatBahrainPhone("97333331101")).toBe("+973 3333 1101");
  });

  it("returns empty string for null", () => {
    expect(formatBahrainPhone(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatBahrainPhone(undefined)).toBe("");
  });
});

describe("isSameBahrainPhone", () => {
  it("returns true for same number in different formats", () => {
    expect(isSameBahrainPhone("33331101", "+973 3333 1101")).toBe(true);
  });

  it("returns true for identical strings", () => {
    expect(isSameBahrainPhone("33331101", "33331101")).toBe(true);
  });

  it("returns false for different numbers", () => {
    expect(isSameBahrainPhone("33331101", "36009999")).toBe(false);
  });

  it("returns false when either is invalid", () => {
    expect(isSameBahrainPhone("invalid", "33331101")).toBe(false);
  });
});
