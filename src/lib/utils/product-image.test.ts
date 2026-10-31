import { describe, expect, it } from "vitest";
import {
  buildColorImageCards,
  colorDisplayName,
  isUsableImageUrl,
  resolveCoverImage,
  resolveDisplayImageUrl,
} from "./product-image";

const mainImage = { url: "https://cdn/main.jpg", color: null };
const blackImage = { url: "https://cdn/black.jpg", color: "Black" };
const roseImage = { url: "https://cdn/rose.jpg", color: "Rani Pink" };

describe("resolveDisplayImageUrl", () => {
  it("returns the color image when one exists for the requested color", () => {
    expect(resolveDisplayImageUrl([mainImage, blackImage], "Black")).toBe("https://cdn/black.jpg");
  });

  it("shows the placeholder, not the main image, for a color missing its photo once the product has color photos", () => {
    expect(resolveDisplayImageUrl([mainImage, blackImage], "Beige")).toBeNull();
  });

  it("keeps showing the legacy main image for every color of a product with no color photos", () => {
    expect(resolveDisplayImageUrl([mainImage], "Beige")).toBe("https://cdn/main.jpg");
    expect(resolveDisplayImageUrl([mainImage], "Black")).toBe("https://cdn/main.jpg");
  });

  it("falls back to the main image when no color is requested", () => {
    expect(resolveDisplayImageUrl([mainImage, blackImage])).toBe("https://cdn/main.jpg");
  });

  it("returns null (placeholder) when there is no color image and no main image", () => {
    expect(resolveDisplayImageUrl([blackImage], "Beige")).toBeNull();
  });

  it("returns null when there are no images at all", () => {
    expect(resolveDisplayImageUrl([], "Black")).toBeNull();
  });

  it("matches color case-insensitively", () => {
    expect(resolveDisplayImageUrl([mainImage, blackImage], "black")).toBe("https://cdn/black.jpg");
    expect(resolveDisplayImageUrl([mainImage, blackImage], "BLACK")).toBe("https://cdn/black.jpg");
  });

  it("matches color ignoring surrounding whitespace", () => {
    expect(resolveDisplayImageUrl([mainImage, blackImage], "  Black  ")).toBe("https://cdn/black.jpg");
  });

  it("matches multi-word colors like 'Rani Pink' exactly", () => {
    expect(resolveDisplayImageUrl([mainImage, blackImage, roseImage], "Rani Pink")).toBe(
      "https://cdn/rose.jpg",
    );
  });

  it("prefers the requested color's image over the main image when both exist", () => {
    const result = resolveDisplayImageUrl([mainImage, blackImage], "Black");
    expect(result).not.toBe(mainImage.url);
  });

  it("never picks a different color's image as a fallback (only main, never another color)", () => {
    expect(resolveDisplayImageUrl([blackImage, roseImage], "Beige")).toBeNull();
  });
});

const base = "https://x.supabase.co/storage/v1/object/public/product-images";
const main = { id: "main", url: `${base}/main.jpg`, color: null, is_primary: false };
const brown = { id: "brown", url: `${base}/brown.jpg`, color: "BROWN", is_primary: false };
const cream = { id: "cream", url: `${base}/cream.jpg`, color: "CREAM", is_primary: false };

describe("isUsableImageUrl", () => {
  it("accepts storage URLs and local paths", () => {
    expect(isUsableImageUrl(brown.url)).toBe(true);
    expect(isUsableImageUrl("https://images.unsplash.com/photo.jpg")).toBe(true);
    expect(isUsableImageUrl("/placeholder.png")).toBe(true);
  });

  it("rejects everything next/image would crash on", () => {
    for (const bad of [null, undefined, "", "   ", "not-a-url", "//evil.com/a.jpg", "http://x.supabase.co/a.jpg", "https://evil.com/a.jpg", "https://x.supabase.co/a b.jpg"]) {
      expect(isUsableImageUrl(bad)).toBe(false);
    }
  });
});

describe("resolveCoverImage", () => {
  it("uses the selected cover, even a color photo over the main image", () => {
    expect(resolveCoverImage([main, { ...brown, is_primary: true }, cream])?.id).toBe("brown");
  });

  it("falls back to the legacy main image, then the first color alphabetically", () => {
    expect(resolveCoverImage([cream, main])?.id).toBe("main");
    expect(resolveCoverImage([cream, brown])?.id).toBe("brown");
  });

  it("skips a cover with an unusable URL rather than showing nothing", () => {
    expect(resolveCoverImage([{ ...brown, is_primary: true, url: "" }, cream])?.id).toBe("cream");
  });

  it("returns null when there is nothing usable", () => {
    expect(resolveCoverImage([])).toBeNull();
    expect(resolveCoverImage([{ ...brown, url: "bad" }])).toBeNull();
  });
});

describe("buildColorImageCards", () => {
  const colors = ["BROWN", "BROWN", "brown ", "CREAM", "CREAM", "MAROON", "OLIVE"];

  it("shows every unique color once, however many sizes it has", () => {
    expect(buildColorImageCards(colors, []).map((card) => card.label)).toEqual(["BROWN", "CREAM", "MAROON", "OLIVE"]);
  });

  it("matches each color to its own photo, and leaves a missing color empty", () => {
    const cards = buildColorImageCards(colors, [brown, cream]);
    expect(cards.map((card) => card.image?.id ?? null)).toEqual(["brown", "cream", null, null]);
  });

  it("never lets a color borrow the cover or another color's photo", () => {
    const cards = buildColorImageCards(["MAROON"], [{ ...brown, is_primary: true }, main]);
    expect(cards.find((card) => card.color === "MAROON")?.image).toBeNull();
  });

  it("marks exactly one card as the cover", () => {
    const cards = buildColorImageCards(colors, [brown, { ...cream, is_primary: true }]);
    expect(cards.filter((card) => card.isCover).map((card) => card.label)).toEqual(["CREAM"]);
  });

  it("keeps a legacy main image visible so it can still be the cover", () => {
    const cards = buildColorImageCards(["BROWN"], [brown, { ...main, is_primary: true }]);
    expect(cards.at(-1)).toMatchObject({ kind: "general", color: null, label: "General photo", isCover: true });
  });

  it("keeps a photo whose color was removed from the product, rather than losing it", () => {
    const cards = buildColorImageCards(["CREAM"], [brown, cream]);
    expect(cards.map((card) => [card.label, card.kind])).toEqual([
      ["CREAM", "color"],
      ["BROWN", "retired-color"],
    ]);
  });

  it("ignores blank colors", () => {
    expect(buildColorImageCards(["", "  "], [])).toEqual([]);
  });
});

describe("colorDisplayName", () => {
  it("formats a stored color for staff messages", () => {
    expect(colorDisplayName(" MUSTARD  YELLOW ")).toBe("Mustard Yellow");
  });
});
