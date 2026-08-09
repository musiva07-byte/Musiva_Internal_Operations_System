import { z } from "zod";

export const MAX_CATEGORY_NAME_LENGTH = 60;

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Category name is required.")
  .max(MAX_CATEGORY_NAME_LENGTH, `Category name must be ${MAX_CATEGORY_NAME_LENGTH} characters or fewer.`);

/**
 * Pure client-side pre-check so "Save category" can show an error immediately,
 * without a round trip. createCategory() in product.service.ts re-validates
 * independently server-side — this is a UX convenience only, never the source
 * of truth (the categories.name column is also unique in the database).
 */
export function validateNewCategoryName(name: string, existingNames: string[]): string | null {
  const parsed = categoryNameSchema.safeParse(name);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Category name is required.";
  }

  const trimmed = parsed.data;
  const isDuplicate = existingNames.some(
    (existing) => existing.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (isDuplicate) {
    return "This category already exists.";
  }

  return null;
}
