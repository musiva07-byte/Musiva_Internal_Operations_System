export const PUBLISHING_BLOCKED_MESSAGE =
  "This product is missing required website details before publishing.";

export type ReadinessVariant = {
  status: string;
  stockQuantity: number;
  regularSellingPriceBhd: number | null;
};

export type PublishingReadinessInput = {
  name: string;
  slug: string | null | undefined;
  variants: ReadinessVariant[];
  hasImage: boolean;
};

export type PublishingReadiness = {
  ready: boolean;
  /** Hard blockers — publishing cannot proceed while these are non-empty. */
  missing: string[];
  /** Soft warnings — shown to staff but do not block publishing. */
  recommendations: string[];
};

/**
 * A product is ready to publish only when it has a name, a slug, at least
 * one active variant, a selling price on an active variant, and available
 * stock on an active variant. A product image is recommended but not
 * required — it is surfaced as a recommendation, not a blocker.
 */
export function getPublishingReadiness(input: PublishingReadinessInput): PublishingReadiness {
  const missing: string[] = [];
  const recommendations: string[] = [];

  if (!input.name.trim()) {
    missing.push("product name");
  }
  if (!input.slug) {
    missing.push("website slug");
  }

  const activeVariants = input.variants.filter((v) => v.status === "active");
  if (activeVariants.length === 0) {
    missing.push("at least one active size/color option");
  }

  const hasPrice = activeVariants.some((v) => (v.regularSellingPriceBhd ?? 0) > 0);
  if (activeVariants.length > 0 && !hasPrice) {
    missing.push("a selling price on at least one active option");
  }

  const hasStock = activeVariants.some((v) => v.stockQuantity > 0);
  if (activeVariants.length > 0 && !hasStock) {
    missing.push("available stock on at least one active option");
  }

  if (!input.hasImage) {
    recommendations.push("a product image");
  }

  return { ready: missing.length === 0, missing, recommendations };
}

/**
 * Server-side gate for publish/unpublish. Combines the role check and the
 * readiness check so both createProduct and updateProduct enforce the same
 * rule. Returns { ok: true } immediately when the caller isn't attempting
 * to make the product public (unpublish/save-as-draft is always allowed to
 * anyone who already passed the general canManageProducts check).
 */
export function checkPublishAttempt(params: {
  wantsPublished: boolean;
  canPublish: boolean;
  readiness: PublishingReadiness;
}): { ok: true } | { ok: false; error: string } {
  if (!params.wantsPublished) {
    return { ok: true };
  }

  if (!params.canPublish) {
    return { ok: false, error: "You do not have permission to publish products." };
  }

  if (!params.readiness.ready) {
    return {
      ok: false,
      error: `${PUBLISHING_BLOCKED_MESSAGE} Missing: ${params.readiness.missing.join(", ")}.`,
    };
  }

  return { ok: true };
}

export type WebsiteFilterValue = "published" | "draft" | "hidden" | "missing_details" | "";

/** Used by the Product Catalog "Website" filter (published / draft / hidden / missing details). */
export function matchesWebsiteFilter(
  product: { online_status: string; website_ready: boolean },
  filter: WebsiteFilterValue,
): boolean {
  switch (filter) {
    case "published":
      return product.online_status === "published";
    case "draft":
      return product.online_status === "draft";
    case "hidden":
      return product.online_status === "hidden";
    case "missing_details":
      return !product.website_ready;
    default:
      return true;
  }
}
