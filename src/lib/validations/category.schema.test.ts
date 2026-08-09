import { describe, expect, it } from "vitest";
import { validateNewCategoryName, MAX_CATEGORY_NAME_LENGTH } from "./category.schema";

const EXISTING = ["Dresses", "Abayas", "Tops", "Bottoms", "Bags", "Accessories", "Luxury Wear", "New Collection"];

describe("validateNewCategoryName", () => {
  it("rejects an empty name", () => {
    expect(validateNewCategoryName("", EXISTING)).toBe("Category name is required.");
  });

  it("rejects a whitespace-only name", () => {
    expect(validateNewCategoryName("   ", EXISTING)).toBe("Category name is required.");
  });

  it("rejects a name longer than the max length", () => {
    const tooLong = "A".repeat(MAX_CATEGORY_NAME_LENGTH + 1);
    expect(validateNewCategoryName(tooLong, EXISTING)).toMatch(/60 characters or fewer/);
  });

  it("accepts a name exactly at the max length", () => {
    const exact = "A".repeat(MAX_CATEGORY_NAME_LENGTH);
    expect(validateNewCategoryName(exact, EXISTING)).toBeNull();
  });

  it("rejects a case-insensitive duplicate", () => {
    expect(validateNewCategoryName("dresses", EXISTING)).toBe("This category already exists.");
    expect(validateNewCategoryName("DRESSES", EXISTING)).toBe("This category already exists.");
    expect(validateNewCategoryName("DrEsSeS", EXISTING)).toBe("This category already exists.");
  });

  it("rejects a duplicate that only differs by surrounding whitespace", () => {
    expect(validateNewCategoryName("  Dresses  ", EXISTING)).toBe("This category already exists.");
  });

  it.each(["Kaftans", "Scarves", "Kids Wear", "Party Wear", "Winter Collection"])(
    "accepts a normal new category name: %s",
    (name) => {
      expect(validateNewCategoryName(name, EXISTING)).toBeNull();
    },
  );

  it("does not flag a name as duplicate against an empty existing list", () => {
    expect(validateNewCategoryName("Kaftans", [])).toBeNull();
  });
});
