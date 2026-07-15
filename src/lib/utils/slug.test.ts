import { describe, expect, it } from "vitest";
import { generateUniqueProductSlug, slugify } from "./slug";

describe("slugify", () => {
  it("converts a simple name to a slug", () => {
    expect(slugify("A line top")).toBe("a-line-top");
  });

  it("converts a multi-word name to a slug", () => {
    expect(slugify("Pearl Trim Abaya")).toBe("pearl-trim-abaya");
  });

  it("lowercases the input", () => {
    expect(slugify("SATIN DRESS")).toBe("satin-dress");
  });

  it("trims leading and trailing whitespace", () => {
    expect(slugify("  Rose Gold Clutch  ")).toBe("rose-gold-clutch");
  });

  it("collapses multiple spaces into one hyphen", () => {
    expect(slugify("Silk   Blend   Scarf")).toBe("silk-blend-scarf");
  });

  it("removes unsafe characters", () => {
    expect(slugify("Abaya (Limited Edition!) #1")).toBe("abaya-limited-edition-1");
  });

  it("strips leading and trailing hyphens produced by stripped characters", () => {
    expect(slugify("*** Sale Item ***")).toBe("sale-item");
  });

  it("keeps existing hyphens and numbers", () => {
    expect(slugify("Size 2-in-1 Wrap")).toBe("size-2-in-1-wrap");
  });

  it("returns an empty string for input with no safe characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("generateUniqueProductSlug", () => {
  it("returns the base slug when it is not taken", async () => {
    const slug = await generateUniqueProductSlug("Pearl Trim Abaya", "MSV-10001", async () => false);
    expect(slug).toBe("pearl-trim-abaya");
  });

  it("appends the slugified SKU when the base slug is taken", async () => {
    const taken = new Set(["pearl-trim-abaya"]);
    const slug = await generateUniqueProductSlug(
      "Pearl Trim Abaya",
      "MSV-10001",
      async (candidate) => taken.has(candidate),
    );
    expect(slug).toBe("pearl-trim-abaya-msv-10001");
  });

  it("appends a numeric suffix when the base and SKU-suffixed slug are both taken", async () => {
    const taken = new Set(["pearl-trim-abaya", "pearl-trim-abaya-msv-10001"]);
    const slug = await generateUniqueProductSlug(
      "Pearl Trim Abaya",
      "MSV-10001",
      async (candidate) => taken.has(candidate),
    );
    expect(slug).toBe("pearl-trim-abaya-msv-10001-2");
  });

  it("keeps incrementing the numeric suffix until a free slug is found", async () => {
    const taken = new Set([
      "pearl-trim-abaya",
      "pearl-trim-abaya-msv-10001",
      "pearl-trim-abaya-msv-10001-2",
      "pearl-trim-abaya-msv-10001-3",
    ]);
    const slug = await generateUniqueProductSlug(
      "Pearl Trim Abaya",
      "MSV-10001",
      async (candidate) => taken.has(candidate),
    );
    expect(slug).toBe("pearl-trim-abaya-msv-10001-4");
  });

  it("falls back to the SKU when the name has no safe characters", async () => {
    const slug = await generateUniqueProductSlug("!!!", "MSV-10001", async () => false);
    expect(slug).toBe("msv-10001");
  });

  it("falls back to a timestamp-based slug when both name and SKU are unusable", async () => {
    const slug = await generateUniqueProductSlug("!!!", "###", async () => false);
    expect(slug.startsWith("product-")).toBe(true);
  });
});
