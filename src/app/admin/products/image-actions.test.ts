/**
 * Tests for the product image Server Actions — the boundary between the client widget and
 * product-image.service.ts. These must never reject/throw: a rejected Server Action promise
 * becomes an uncaught error in the calling Client Component's transition, which is exactly
 * what rendered the global "Unexpected error" page for this feature. product-image.service.ts
 * already catches its own failures; this file's try/catch is the second line of defense in
 * case anything else (e.g. malformed FormData) throws before/around that call.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUploadProductImage, mockRemoveProductImage } = vi.hoisted(() => ({
  mockUploadProductImage: vi.fn(),
  mockRemoveProductImage: vi.fn(),
}));

vi.mock("@/lib/services/product-image.service", () => ({
  uploadProductImage: mockUploadProductImage,
  removeProductImage: mockRemoveProductImage,
}));

import { uploadProductImageAction, removeProductImageAction } from "./image-actions";

function makeFormData(file: File | null): FormData {
  const fd = new FormData();
  if (file) fd.append("file", file);
  return fd;
}

function makeFile(name = "dress.jpg", type = "image/jpeg", size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("uploadProductImageAction", () => {
  it("returns a friendly error (never throws) when no file is provided", async () => {
    const result = await uploadProductImageAction("product-1", makeFormData(null));
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(mockUploadProductImage).not.toHaveBeenCalled();
  });

  it("passes through a successful result with the new URL", async () => {
    mockUploadProductImage.mockResolvedValue({ data: { url: "https://cdn/img.jpg" }, error: null });
    const result = await uploadProductImageAction("product-1", makeFormData(makeFile()));
    expect(result).toEqual({ ok: true, error: null, url: "https://cdn/img.jpg" });
  });

  it("passes through a friendly failure result instead of throwing", async () => {
    mockUploadProductImage.mockResolvedValue({ data: null, error: "Please upload a JPG, PNG, or WebP image." });
    const result = await uploadProductImageAction("product-1", makeFormData(makeFile()));
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Please upload a JPG, PNG, or WebP image.");
  });

  it("never rejects even if the underlying service throws unexpectedly", async () => {
    mockUploadProductImage.mockRejectedValue(new Error("unexpected"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(uploadProductImageAction("product-1", makeFormData(makeFile()))).resolves.toEqual(
      expect.objectContaining({ ok: false, error: expect.stringMatching(/could not upload image/i) }),
    );

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("removeProductImageAction", () => {
  it("passes through a successful result", async () => {
    mockRemoveProductImage.mockResolvedValue({ data: { productId: "product-1" }, error: null });
    const result = await removeProductImageAction("product-1");
    expect(result).toEqual({ ok: true, error: null });
  });

  it("passes through a friendly failure result instead of throwing", async () => {
    mockRemoveProductImage.mockResolvedValue({ data: null, error: "This product has no image to remove." });
    const result = await removeProductImageAction("product-1");
    expect(result).toEqual({ ok: false, error: "This product has no image to remove." });
  });

  it("never rejects even if the underlying service throws unexpectedly", async () => {
    mockRemoveProductImage.mockRejectedValue(new Error("unexpected"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(removeProductImageAction("product-1")).resolves.toEqual(
      expect.objectContaining({ ok: false, error: expect.stringMatching(/could not remove image/i) }),
    );

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
