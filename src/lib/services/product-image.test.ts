/**
 * Unit tests for product-image.service.ts
 *
 * These tests mock Supabase clients and exercise the pure business logic:
 * permission checks, file validation, upload-then-delete ordering, and
 * error paths.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── mocks ──────────────────────────────────────────────────────────────────────

const mockStorageUpload = vi.fn();
const mockStorageRemove = vi.fn();
const mockStorageGetPublicUrl = vi.fn();
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();

// Admin client stub
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
        getPublicUrl: mockStorageGetPublicUrl,
      }),
    },
  }),
}));

// Server client stub
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: mockDbSelect,
            }),
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: mockDbInsert,
        }),
      }),
      delete: () => ({
        eq: mockDbDelete,
      }),
    }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } }),
    },
  }),
}));

// Authorization stub
vi.mock("@/lib/auth/authorization", () => ({
  requireStaffPermission: vi.fn(),
}));

// next/cache stub
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { uploadProductImage, removeProductImage, getProductImage } from "./product-image.service";
import { requireStaffPermission } from "@/lib/auth/authorization";

// ── helpers ────────────────────────────────────────────────────────────────────

function makeFile(
  name = "dress.jpg",
  type = "image/jpeg",
  size = 1024,
): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

function mockAuthGranted() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(requireStaffPermission).mockResolvedValue({
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: mockDbSelect,
              }),
            }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: mockDbInsert,
          }),
        }),
        delete: () => ({
          eq: mockDbDelete,
        }),
      }),
    } as any,
    userId: "user-1",
    role: "owner" as const,
    error: null,
  });
}

function mockAuthDenied() {
  vi.mocked(requireStaffPermission).mockResolvedValue({
    supabase: null,
    userId: null,
    role: null,
    error: "You do not have permission to perform this action.",
  });
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe("getProductImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no image exists", async () => {
    mockDbSelect.mockResolvedValue({ data: null });
    const result = await getProductImage("product-1");
    expect(result).toBeNull();
  });

  it("returns the image row when one exists", async () => {
    const row = { id: "img-1", product_id: "product-1", url: "https://cdn/img.jpg", path: "product-1/img.jpg" };
    mockDbSelect.mockResolvedValue({ data: row });
    const result = await getProductImage("product-1");
    expect(result).toEqual(row);
  });
});

describe("uploadProductImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn/new.jpg" } });
  });

  it("returns permission error when user lacks access", async () => {
    mockAuthDenied();
    const result = await uploadProductImage("product-1", makeFile());
    expect(result.error).toBeTruthy();
    expect(result.data).toBeFalsy();
  });

  it("rejects an unsupported MIME type", async () => {
    mockAuthGranted();
    const file = makeFile("photo.gif", "image/gif");
    const result = await uploadProductImage("product-1", file);
    expect(result.error).toMatch(/jpeg|png|webp/i);
  });

  it("rejects a file with an unsupported extension", async () => {
    mockAuthGranted();
    const file = makeFile("photo.bmp", "image/bmp");
    const result = await uploadProductImage("product-1", file);
    expect(result.error).toBeTruthy();
  });

  it("rejects a file over 5 MB", async () => {
    mockAuthGranted();
    const tooBig = makeFile("large.jpg", "image/jpeg", 6 * 1024 * 1024);
    const result = await uploadProductImage("product-1", tooBig);
    expect(result.error).toMatch(/5 MB/i);
  });

  it("rejects an empty file", async () => {
    mockAuthGranted();
    const empty = makeFile("empty.jpg", "image/jpeg", 0);
    const result = await uploadProductImage("product-1", empty);
    expect(result.error).toMatch(/empty/i);
  });

  it("returns error when storage upload fails", async () => {
    mockAuthGranted();
    mockDbSelect.mockResolvedValue({ data: null }); // no existing image
    mockStorageUpload.mockResolvedValue({ error: { message: "storage error" } });

    const result = await uploadProductImage("product-1", makeFile());
    expect(result.error).toMatch(/upload failed/i);
  });

  it("uploads successfully and inserts DB record", async () => {
    mockAuthGranted();
    mockDbSelect.mockResolvedValue({ data: null }); // no existing image
    mockStorageUpload.mockResolvedValue({ error: null });
    const inserted = { id: "img-new", product_id: "product-1", url: "https://cdn/new.jpg", path: "product-1/xxx-dress.jpg", is_primary: true };
    mockDbInsert.mockResolvedValue({ data: inserted, error: null });

    const result = await uploadProductImage("product-1", makeFile());
    expect(result.error).toBeNull();
    expect(result.data?.url).toBe("https://cdn/new.jpg");
  });

  it("deletes old storage file after successful replacement", async () => {
    mockAuthGranted();
    const existing = { id: "img-old", product_id: "product-1", url: "https://cdn/old.jpg", path: "product-1/old.jpg" };
    mockDbSelect.mockResolvedValue({ data: existing });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockDbDelete.mockResolvedValue({ error: null });
    const inserted = { id: "img-new", product_id: "product-1", url: "https://cdn/new.jpg", path: "product-1/new.jpg", is_primary: true };
    mockDbInsert.mockResolvedValue({ data: inserted, error: null });
    mockStorageRemove.mockResolvedValue({ error: null });

    await uploadProductImage("product-1", makeFile());
    expect(mockStorageRemove).toHaveBeenCalledWith(["product-1/old.jpg"]);
  });

  it("returns error when DB insert fails after upload", async () => {
    mockAuthGranted();
    mockDbSelect.mockResolvedValue({ data: null });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockDbInsert.mockResolvedValue({ data: null, error: { message: "db error" } });
    mockStorageRemove.mockResolvedValue({ error: null });

    const result = await uploadProductImage("product-1", makeFile());
    expect(result.error).toMatch(/could not be saved/i);
    // Should attempt to clean up the orphaned storage file
    expect(mockStorageRemove).toHaveBeenCalled();
  });
});

describe("removeProductImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns permission error when user lacks access", async () => {
    mockAuthDenied();
    const result = await removeProductImage("product-1");
    expect(result.error).toBeTruthy();
  });

  it("returns error when no image exists", async () => {
    mockAuthGranted();
    mockDbSelect.mockResolvedValue({ data: null });
    const result = await removeProductImage("product-1");
    expect(result.error).toMatch(/no image/i);
  });

  it("deletes DB record and fires storage removal", async () => {
    mockAuthGranted();
    const existing = { id: "img-1", product_id: "product-1", path: "product-1/img.jpg" };
    mockDbSelect.mockResolvedValue({ data: existing });
    mockDbDelete.mockResolvedValue({ error: null });
    mockStorageRemove.mockResolvedValue({ error: null });

    const result = await removeProductImage("product-1");
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ productId: "product-1" });
    expect(mockStorageRemove).toHaveBeenCalledWith(["product-1/img.jpg"]);
  });

  it("returns error when DB delete fails", async () => {
    mockAuthGranted();
    const existing = { id: "img-1", product_id: "product-1", path: "product-1/img.jpg" };
    mockDbSelect.mockResolvedValue({ data: existing });
    mockDbDelete.mockResolvedValue({ error: { message: "db error" } });

    const result = await removeProductImage("product-1");
    expect(result.error).toMatch(/could not be removed/i);
  });
});
