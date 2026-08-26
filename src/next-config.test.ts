/**
 * Regression guard for the Server Actions body size limit. Next.js defaults this to 1 MB;
 * uploadProductImageAction (image-actions.ts) sends product photos up to 4 MB via FormData.
 * Without raising this limit, any real photo between ~1-4 MB is rejected by the Next.js
 * framework itself (a raw 400 before our code ever runs), surfacing to staff as "An
 * unexpected response was received from the server" / the global error page — this bypasses
 * every friendly-error safeguard in product-image.service.ts and image-actions.ts because the
 * request never reaches them.
 *
 * The upper bound matters just as much as the lower one: this app is hosted on Vercel, and
 * Vercel Functions hard-cap every request body at 4.5 MB at the infrastructure level — a
 * limit this config option cannot raise. Setting bodySizeLimit above that would be a no-op in
 * production (Vercel rejects the request before Next.js's own check ever runs) while looking
 * safe in local dev, which is exactly the kind of gap that caused this bug in the first place.
 * Our own MAX_FILE_SIZE (product-image.service.ts / product-image-widget.tsx /
 * product-wizard.tsx) is 4 MB for the same reason — see those files' comments.
 */
import { describe, it, expect } from "vitest";
import nextConfig from "../next.config";

const APP_MAX_UPLOAD_MB = 4; // MAX_FILE_SIZE in product-image.service.ts
const VERCEL_HARD_CAP_MB = 4.5; // infrastructure limit — not configurable, see next.config.ts

describe("next.config.ts — Server Actions body size limit", () => {
  it("is configured (not left at the 1 MB Next.js default)", () => {
    const limit = nextConfig.experimental?.serverActions?.bodySizeLimit;
    expect(limit).toBeDefined();
  });

  it("sits strictly between the app's own 4 MB upload limit and Vercel's 4.5 MB hard cap", () => {
    const limit = nextConfig.experimental?.serverActions?.bodySizeLimit;
    const match = String(limit).match(/^(\d+(?:\.\d+)?)\s*mb$/i);
    expect(match).not.toBeNull();

    const megabytes = Number(match?.[1]);
    expect(megabytes).toBeGreaterThan(APP_MAX_UPLOAD_MB);
    expect(megabytes).toBeLessThanOrEqual(VERCEL_HARD_CAP_MB);
  });
});
