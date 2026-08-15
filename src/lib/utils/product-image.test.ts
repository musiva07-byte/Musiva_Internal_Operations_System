import { describe, expect, it } from "vitest";
import { resolveDisplayImageUrl } from "./product-image";

const mainImage = { url: "https://cdn/main.jpg", color: null };
const blackImage = { url: "https://cdn/black.jpg", color: "Black" };
const roseImage = { url: "https://cdn/rose.jpg", color: "Rani Pink" };

describe("resolveDisplayImageUrl", () => {
  it("returns the color image when one exists for the requested color", () => {
    expect(resolveDisplayImageUrl([mainImage, blackImage], "Black")).toBe("https://cdn/black.jpg");
  });

  it("falls back to the main image when no color image exists for that color", () => {
    expect(resolveDisplayImageUrl([mainImage, blackImage], "Beige")).toBe("https://cdn/main.jpg");
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
