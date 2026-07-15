import { describe, expect, it } from "vitest";
import {
  PUBLISHING_BLOCKED_MESSAGE,
  checkPublishAttempt,
  getPublishingReadiness,
  matchesWebsiteFilter,
} from "./product-publishing";

const readyVariant = { status: "active", stockQuantity: 5, regularSellingPriceBhd: 15 };

describe("getPublishingReadiness", () => {
  it("is ready when name, slug, priced active variant with stock, and image all exist", () => {
    const result = getPublishingReadiness({
      name: "Pearl Trim Abaya",
      slug: "pearl-trim-abaya",
      variants: [readyVariant],
      hasImage: true,
    });
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });

  it("flags a missing product name", () => {
    const result = getPublishingReadiness({
      name: "  ",
      slug: "pearl-trim-abaya",
      variants: [readyVariant],
      hasImage: true,
    });
    expect(result.ready).toBe(false);
    expect(result.missing).toContain("product name");
  });

  it("flags a missing slug", () => {
    const result = getPublishingReadiness({
      name: "Pearl Trim Abaya",
      slug: null,
      variants: [readyVariant],
      hasImage: true,
    });
    expect(result.ready).toBe(false);
    expect(result.missing).toContain("website slug");
  });

  it("flags when there is no active variant", () => {
    const result = getPublishingReadiness({
      name: "Pearl Trim Abaya",
      slug: "pearl-trim-abaya",
      variants: [{ status: "archived", stockQuantity: 5, regularSellingPriceBhd: 15 }],
      hasImage: true,
    });
    expect(result.ready).toBe(false);
    expect(result.missing).toContain("at least one active size/color option");
  });

  it("flags when no active variant has a price", () => {
    const result = getPublishingReadiness({
      name: "Pearl Trim Abaya",
      slug: "pearl-trim-abaya",
      variants: [{ status: "active", stockQuantity: 5, regularSellingPriceBhd: 0 }],
      hasImage: true,
    });
    expect(result.ready).toBe(false);
    expect(result.missing).toContain("a selling price on at least one active option");
  });

  it("flags when no active variant has stock", () => {
    const result = getPublishingReadiness({
      name: "Pearl Trim Abaya",
      slug: "pearl-trim-abaya",
      variants: [{ status: "active", stockQuantity: 0, regularSellingPriceBhd: 15 }],
      hasImage: true,
    });
    expect(result.ready).toBe(false);
    expect(result.missing).toContain("available stock on at least one active option");
  });

  it("recommends but does not require a product image", () => {
    const result = getPublishingReadiness({
      name: "Pearl Trim Abaya",
      slug: "pearl-trim-abaya",
      variants: [readyVariant],
      hasImage: false,
    });
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.recommendations).toContain("a product image");
  });
});

describe("checkPublishAttempt", () => {
  const readyResult = { ready: true, missing: [], recommendations: [] };
  const notReadyResult = { ready: false, missing: ["website slug"], recommendations: [] };

  it("allows saving as draft/hidden regardless of role or readiness", () => {
    const result = checkPublishAttempt({
      wantsPublished: false,
      canPublish: false,
      readiness: notReadyResult,
    });
    expect(result.ok).toBe(true);
  });

  it("blocks publishing for a role without publish permission", () => {
    const result = checkPublishAttempt({
      wantsPublished: true,
      canPublish: false,
      readiness: readyResult,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/do not have permission to publish/i);
    }
  });

  it("blocks publishing when the product is not ready, even for an authorized role", () => {
    const result = checkPublishAttempt({
      wantsPublished: true,
      canPublish: true,
      readiness: notReadyResult,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(PUBLISHING_BLOCKED_MESSAGE);
      expect(result.error).toContain("website slug");
    }
  });

  it("allows publishing for an authorized role with a ready product", () => {
    const result = checkPublishAttempt({
      wantsPublished: true,
      canPublish: true,
      readiness: readyResult,
    });
    expect(result.ok).toBe(true);
  });
});

describe("matchesWebsiteFilter", () => {
  const published = { online_status: "published", website_ready: true };
  const draft = { online_status: "draft", website_ready: true };
  const hidden = { online_status: "hidden", website_ready: true };
  const missingDetails = { online_status: "hidden", website_ready: false };

  it("matches published products", () => {
    expect(matchesWebsiteFilter(published, "published")).toBe(true);
    expect(matchesWebsiteFilter(draft, "published")).toBe(false);
  });

  it("matches draft products", () => {
    expect(matchesWebsiteFilter(draft, "draft")).toBe(true);
    expect(matchesWebsiteFilter(published, "draft")).toBe(false);
  });

  it("matches hidden products", () => {
    expect(matchesWebsiteFilter(hidden, "hidden")).toBe(true);
    expect(matchesWebsiteFilter(published, "hidden")).toBe(false);
  });

  it("matches products missing publishing details regardless of status", () => {
    expect(matchesWebsiteFilter(missingDetails, "missing_details")).toBe(true);
    expect(matchesWebsiteFilter(published, "missing_details")).toBe(false);
  });

  it("matches everything when no filter is set", () => {
    expect(matchesWebsiteFilter(published, "")).toBe(true);
    expect(matchesWebsiteFilter(hidden, "")).toBe(true);
  });
});
