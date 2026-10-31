/**
 * Unit tests for product-image.service.ts
 *
 * The Supabase client is an in-memory product_images table, so these assert what actually
 * happened to the rows (only the intended color changed, one cover at a time) as well as
 * permission checks, file validation, upload-then-delete ordering, and error paths. Every table
 * touched is recorded, proving image actions can't reach prices or stock.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { canManageProducts } from "@/lib/auth/permissions";

// ── mocks ──────────────────────────────────────────────────────────────────────

const mockStorageUpload = vi.fn();
const mockStorageRemove = vi.fn();
const mockStorageGetPublicUrl = vi.fn();
const mockStorageCreateBucket = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    storage: {
      createBucket: mockStorageCreateBucket,
      from: () => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
        getPublicUrl: mockStorageGetPublicUrl,
      }),
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => null,
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireStaffPermission: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { uploadProductImage, removeProductImage, setProductCoverImage } from "./product-image.service";
import { requireStaffPermission } from "@/lib/auth/authorization";

// ── in-memory table ────────────────────────────────────────────────────────────

type Row = {
  id: string;
  product_id: string;
  variant_id: string | null;
  color: string | null;
  url: string;
  path: string;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
};

let table: Row[] = [];
let tablesTouched: string[] = [];
let failNext: { op: "select" | "insert" | "update" | "delete"; onCall?: number } | null = null;
let opCalls: Record<string, number> = {};
let selectThrows = false;

function row(id: string, color: string | null, is_primary = false): Row {
  return {
    id,
    product_id: "product-1",
    variant_id: null,
    color,
    url: `https://x.supabase.co/storage/v1/object/public/product-images/${id}.jpg`,
    path: `product-1/${id}.jpg`,
    is_primary,
    sort_order: 0,
    created_at: "2026-10-31T00:00:00Z",
  };
}

function shouldFail(op: string) {
  opCalls[op] = (opCalls[op] ?? 0) + 1;
  if (failNext?.op !== op) return false;
  return (failNext.onCall ?? 1) === opCalls[op];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeClient(): any {
  return {
    from(name: string) {
      tablesTouched.push(name);
      return {
        select() {
          if (selectThrows) throw new Error("unexpected connection failure");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const chain: any = {
            eq: () => chain,
            then: (resolve: (value: unknown) => void) =>
              resolve(
                shouldFail("select")
                  ? { data: null, error: { message: "secret db detail" } }
                  : { data: table.map((r) => ({ ...r })), error: null },
              ),
          };
          return chain;
        },
        insert(payload: Partial<Row>) {
          return {
            select: () => ({
              single: async () => {
                if (shouldFail("insert")) return { data: null, error: { message: "secret db detail" } };
                const inserted = { ...row("img-new", null), ...payload, id: "img-new" } as Row;
                table.push(inserted);
                return { data: inserted, error: null };
              },
            }),
          };
        },
        update(patch: Partial<Row>) {
          const apply = (match: (r: Row) => boolean) => {
            if (shouldFail("update")) return { data: null, error: { message: "secret db detail" } };
            table = table.map((r) => (match(r) ? { ...r, ...patch } : r));
            return { data: null, error: null };
          };
          return {
            eq: (_col: string, id: string) => {
              const result = apply((r) => r.id === id);
              return {
                then: (resolve: (value: unknown) => void) => resolve(result),
                select: () => ({
                  single: async () =>
                    result.error ? result : { data: table.find((r) => r.id === id) ?? null, error: null },
                }),
              };
            },
            in: async (_col: string, ids: string[]) => apply((r) => ids.includes(r.id)),
          };
        },
        delete() {
          return {
            eq: async (_col: string, id: string) => {
              if (shouldFail("delete")) return { error: { message: "secret db detail" } };
              table = table.filter((r) => r.id !== id);
              return { error: null };
            },
          };
        },
      };
    },
  };
}

// ── helpers ────────────────────────────────────────────────────────────────────

function makeFile(name = "dress.jpg", type = "image/jpeg", size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

function mockAuthGranted() {
  vi.mocked(requireStaffPermission).mockResolvedValue({
    supabase: fakeClient(),
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

const urlOf = (id: string) => table.find((r) => r.id === id)?.url;
const covers = () => table.filter((r) => r.is_primary).map((r) => r.id);

beforeEach(() => {
  vi.clearAllMocks();
  table = [];
  tablesTouched = [];
  failNext = null;
  opCalls = {};
  selectThrows = false;
  mockStorageUpload.mockReset().mockResolvedValue({ error: null });
  mockStorageRemove.mockReset().mockResolvedValue({ error: null });
  mockStorageGetPublicUrl.mockReset().mockReturnValue({
    data: { publicUrl: "https://x.supabase.co/storage/v1/object/public/product-images/new.jpg" },
  });
  mockAuthGranted();
});

// ── tests ──────────────────────────────────────────────────────────────────────

describe("uploadProductImage — validation", () => {
  it("rejects an unsupported MIME type", async () => {
    const result = await uploadProductImage("product-1", makeFile("photo.gif", "image/gif"));
    expect(result.error).toMatch(/jpg|png|webp/i);
  });

  it("rejects a file with an unsupported extension", async () => {
    const result = await uploadProductImage("product-1", makeFile("photo.bmp", "image/bmp"));
    expect(result.error).toBeTruthy();
  });

  it("rejects a file over 4 MB (kept under Vercel's 4.5 MB hard request-body cap)", async () => {
    const result = await uploadProductImage("product-1", makeFile("large.jpg", "image/jpeg", 4.2 * 1024 * 1024));
    expect(result.error).toMatch(/4 MB/i);
  });

  it("rejects an empty file", async () => {
    const result = await uploadProductImage("product-1", makeFile("empty.jpg", "image/jpeg", 0));
    expect(result.error).toMatch(/empty/i);
  });

  it("accepts a valid PNG and WebP", async () => {
    expect((await uploadProductImage("product-1", makeFile("dress.png", "image/png"), "Black")).error).toBeNull();
    expect((await uploadProductImage("product-1", makeFile("dress.webp", "image/webp"), "Brown")).error).toBeNull();
  });
});

describe("uploadProductImage — one photo per color", () => {
  it("adds a photo for only the selected color", async () => {
    table = [row("cream", "CREAM", true), row("maroon", "MAROON")];
    const before = table.map((r) => ({ ...r }));

    const result = await uploadProductImage("product-1", makeFile(), "BROWN");

    expect(result.error).toBeNull();
    expect(table).toHaveLength(3);
    expect(table.find((r) => r.id === "img-new")?.color).toBe("BROWN");
    expect(table.slice(0, 2)).toEqual(before);
  });

  it("makes the first photo of a product the cover, and later ones not", async () => {
    await uploadProductImage("product-1", makeFile(), "BROWN");
    expect(table[0]).toMatchObject({ color: "BROWN", is_primary: true });

    table = [row("cream", "CREAM", true)];
    await uploadProductImage("product-1", makeFile(), "BROWN");
    expect(table.find((r) => r.color === "BROWN")?.is_primary).toBe(false);
  });

  it("does not take the cover from an existing legacy main image", async () => {
    table = [row("main", null, true)];
    await uploadProductImage("product-1", makeFile(), "BROWN");
    expect(covers()).toEqual(["main"]);
  });

  it("treats a blank color as the legacy main image", async () => {
    await uploadProductImage("product-1", makeFile(), "   ");
    expect(table[0].color).toBeNull();
  });

  it("replaces only the selected color, in place, keeping its row and cover status", async () => {
    table = [row("brown", "BROWN", true), row("cream", "CREAM"), row("main", null)];
    const creamUrl = urlOf("cream");
    const mainUrl = urlOf("main");

    const result = await uploadProductImage("product-1", makeFile(), "BROWN");

    expect(result.error).toBeNull();
    expect(table).toHaveLength(3);
    expect(table.find((r) => r.id === "brown")).toMatchObject({
      is_primary: true,
      url: "https://x.supabase.co/storage/v1/object/public/product-images/new.jpg",
    });
    expect(urlOf("cream")).toBe(creamUrl);
    expect(urlOf("main")).toBe(mainUrl);
    expect(mockStorageRemove).toHaveBeenCalledWith(["product-1/brown.jpg"]);
  });

  it("replaces rather than duplicates when the color differs only by case or spaces", async () => {
    table = [row("brown", "BROWN")];
    await uploadProductImage("product-1", makeFile(), " Brown ");
    expect(table).toHaveLength(1);
    expect(table[0].id).toBe("brown");
  });

  it("keeps the old storage file while another row still references it", async () => {
    table = [row("brown", "BROWN"), { ...row("cream", "CREAM"), path: "product-1/brown.jpg" }];
    await uploadProductImage("product-1", makeFile(), "BROWN");
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });
});

describe("uploadProductImage — failures never lose a photo", () => {
  it("leaves the old photo untouched when the storage upload fails", async () => {
    table = [row("brown", "BROWN", true)];
    const before = table.map((r) => ({ ...r }));
    mockStorageUpload.mockResolvedValue({ error: { message: "network error" } });

    const result = await uploadProductImage("product-1", makeFile(), "BROWN");

    expect(result.error).toBe("Could not upload this photo. Please try again.");
    expect(table).toEqual(before);
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it("keeps the old photo and cleans up the new file when the database update fails", async () => {
    table = [row("brown", "BROWN", true)];
    const before = table.map((r) => ({ ...r }));
    failNext = { op: "update" };

    const result = await uploadProductImage("product-1", makeFile(), "BROWN");

    expect(result.error).toBe("Could not upload this photo. Please try again.");
    expect(table).toEqual(before);
    expect(mockStorageRemove).toHaveBeenCalledTimes(1);
    expect(mockStorageRemove).not.toHaveBeenCalledWith(["product-1/brown.jpg"]);
  });

  it("cleans up the file and shows the friendly message when a new row can't be saved", async () => {
    failNext = { op: "insert" };
    const result = await uploadProductImage("product-1", makeFile(), "BROWN");
    expect(result.error).toBe("Could not upload this photo. Please try again.");
    expect(mockStorageRemove).toHaveBeenCalled();
  });

  it("never saves an empty URL", async () => {
    mockStorageGetPublicUrl.mockReturnValue({ data: { publicUrl: "" } });
    const result = await uploadProductImage("product-1", makeFile(), "BROWN");
    expect(result.error).toBe("Could not upload this photo. Please try again.");
    expect(table).toHaveLength(0);
    expect(mockStorageRemove).toHaveBeenCalled();
  });

  it("catches an unexpected exception and returns a friendly message instead of throwing", async () => {
    mockStorageUpload.mockImplementation(() => {
      throw new Error("unexpected network failure");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(uploadProductImage("product-1", makeFile())).resolves.toEqual(
      expect.objectContaining({ error: "Could not upload this photo. Please try again." }),
    );
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("removeProductImage", () => {
  it("removes only the selected color", async () => {
    table = [row("brown", "BROWN"), row("cream", "CREAM", true), row("main", null)];

    const result = await removeProductImage("product-1", "BROWN");

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ productId: "product-1" });
    expect(table.map((r) => r.id)).toEqual(["cream", "main"]);
    expect(mockStorageRemove).toHaveBeenCalledWith(["product-1/brown.jpg"]);
  });

  it("does not move the cover when a non-cover photo is removed", async () => {
    table = [row("brown", "BROWN"), row("cream", "CREAM", true)];
    await removeProductImage("product-1", "BROWN");
    expect(covers()).toEqual(["cream"]);
  });

  it("promotes another color photo when the cover is removed", async () => {
    table = [row("main", null), row("maroon", "MAROON"), row("brown", "BROWN", true), row("cream", "CREAM")];
    await removeProductImage("product-1", "BROWN");
    expect(covers()).toEqual(["cream"]);
  });

  it("falls back to the legacy main image when no other color photo remains", async () => {
    table = [row("brown", "BROWN", true), row("main", null)];
    await removeProductImage("product-1", "BROWN");
    expect(covers()).toEqual(["main"]);
  });

  it("leaves no cover, and no error, when the last photo is removed", async () => {
    table = [row("brown", "BROWN", true)];
    const result = await removeProductImage("product-1", "BROWN");
    expect(result.error).toBeNull();
    expect(table).toEqual([]);
  });

  it("keeps the storage file while another row references it", async () => {
    table = [row("brown", "BROWN"), { ...row("cream", "CREAM"), path: "product-1/brown.jpg" }];
    await removeProductImage("product-1", "BROWN");
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it("returns an error when there is nothing to remove for that color", async () => {
    table = [row("cream", "CREAM")];
    const result = await removeProductImage("product-1", "BROWN");
    expect(result.error).toMatch(/no image/i);
    expect(table).toHaveLength(1);
  });

  it("restores the cover and keeps the photo when the delete fails", async () => {
    table = [row("brown", "BROWN", true), row("cream", "CREAM")];
    const before = table.map((r) => ({ ...r }));
    failNext = { op: "delete" };

    const result = await removeProductImage("product-1", "BROWN");

    expect(result.error).toBe("Could not remove this photo. Please try again.");
    expect(table).toEqual(before);
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it("catches an unexpected exception and returns a friendly message instead of throwing", async () => {
    selectThrows = true;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(removeProductImage("product-1")).resolves.toEqual(
      expect.objectContaining({ error: "Could not remove this photo. Please try again." }),
    );
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("setProductCoverImage", () => {
  it("moves the cover to the chosen photo, leaving exactly one cover", async () => {
    table = [row("main", null, true), row("brown", "BROWN"), row("cream", "CREAM")];
    const result = await setProductCoverImage("product-1", "brown");
    expect(result.error).toBeNull();
    expect(covers()).toEqual(["brown"]);
  });

  it("changes only the cover flag: no upload, no new row, no URL or color change", async () => {
    table = [row("main", null, true), row("brown", "BROWN")];
    const strip = (r: Row) => ({ id: r.id, color: r.color, url: r.url, path: r.path });
    const before = table.map(strip);

    await setProductCoverImage("product-1", "brown");

    expect(table.map(strip)).toEqual(before);
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it("repairs a product that somehow has two covers", async () => {
    table = [row("main", null, true), row("brown", "BROWN", true), row("cream", "CREAM")];
    await setProductCoverImage("product-1", "cream");
    expect(covers()).toEqual(["cream"]);
  });

  it("refuses an image that doesn't belong to this product's rows", async () => {
    table = [row("brown", "BROWN", true)];
    const result = await setProductCoverImage("product-1", "someone-elses-image");
    expect(result.error).toBe("Could not change the cover photo. Please try again.");
    expect(covers()).toEqual(["brown"]);
  });

  it("undoes the change if the previous cover can't be cleared", async () => {
    table = [row("main", null, true), row("brown", "BROWN")];
    failNext = { op: "update", onCall: 2 };

    const result = await setProductCoverImage("product-1", "brown");

    expect(result.error).toBe("Could not change the cover photo. Please try again.");
    expect(covers()).toEqual(["main"]);
  });
});

describe("image actions are isolated from pricing and stock", () => {
  it("only ever touch the product_images table, across upload, replace, cover and remove", async () => {
    table = [row("brown", "BROWN", true), row("cream", "CREAM")];

    await uploadProductImage("product-1", makeFile(), "MAROON");
    await uploadProductImage("product-1", makeFile(), "BROWN");
    await setProductCoverImage("product-1", "cream");
    await removeProductImage("product-1", "BROWN");

    expect(new Set(tablesTouched)).toEqual(new Set(["product_images"]));
  });
});

describe("permissions are enforced on the server", () => {
  it("requires the product-management permission for every image action", async () => {
    table = [row("brown", "BROWN", true)];
    await uploadProductImage("product-1", makeFile(), "BROWN");
    await removeProductImage("product-1", "BROWN");
    await setProductCoverImage("product-1", "brown");

    const checks = vi.mocked(requireStaffPermission).mock.calls.map(([check]) => check);
    expect(checks).toEqual([canManageProducts, canManageProducts, canManageProducts]);
  });

  it("does nothing at all when the user lacks permission", async () => {
    mockAuthDenied();
    table = [row("brown", "BROWN", true), row("cream", "CREAM")];
    const before = table.map((r) => ({ ...r }));

    expect((await uploadProductImage("product-1", makeFile(), "BROWN")).error).toBeTruthy();
    expect((await removeProductImage("product-1", "BROWN")).error).toBeTruthy();
    expect((await setProductCoverImage("product-1", "cream")).error).toBeTruthy();

    expect(table).toEqual(before);
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it("limits image management to owner, manager and inventory staff", () => {
    expect(canManageProducts("owner")).toBe(true);
    expect(canManageProducts("manager")).toBe(true);
    expect(canManageProducts("inventory_staff")).toBe(true);
    expect(canManageProducts("sales_staff")).toBe(false);
    expect(canManageProducts("accountant")).toBe(false);
    expect(canManageProducts("delivery_coordinator")).toBe(false);
  });
});

describe("error messages", () => {
  it("never leak raw database text to staff", async () => {
    table = [row("brown", "BROWN", true), row("cream", "CREAM")];
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    failNext = { op: "select" };
    opCalls = {};
    const results: { error: string | null }[] = [await uploadProductImage("product-1", makeFile(), "BROWN")];
    failNext = { op: "delete" };
    opCalls = {};
    results.push(await removeProductImage("product-1", "CREAM"));
    failNext = { op: "update" };
    opCalls = {};
    results.push(await setProductCoverImage("product-1", "cream"));

    for (const result of results) {
      expect(result.error).toBeTruthy();
      expect(result.error).not.toContain("secret db detail");
    }
    consoleSpy.mockRestore();
  });
});
