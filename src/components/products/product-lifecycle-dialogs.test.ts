/**
 * Structural regression guard for ProductArchiveDialog / ProductRestoreDialog error feedback.
 *
 * Found during this unit: both dialogs called their server action and, on failure, did
 * nothing at all — no error message, no visual change, the button just stopped spinning.
 * Staff clicking "Archive product" on a blocked/failed request would see the dialog just
 * sit there with zero explanation. These tests lock in that both dialogs now track and
 * display the error, matching the pattern already used by ProductDeleteDialog and
 * QuickAddStockDialog (same source-text-guard approach as product-cost-dialog.test.ts —
 * no rendering harness in this codebase).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const archiveSource = readFileSync(join(__dirname, "product-archive-dialog.tsx"), "utf-8");
const restoreSource = readFileSync(join(__dirname, "product-restore-dialog.tsx"), "utf-8");

describe.each([
  ["ProductArchiveDialog", archiveSource, "archived"],
  ["ProductRestoreDialog", restoreSource, "restored"],
])("%s — no silent failure", (_name, source, verb) => {
  it("tracks an error state", () => {
    expect(source).toMatch(/const \[error, setError\] = useState<string \| null>\(null\)/);
  });

  it("sets a friendly error message when the server action reports failure", () => {
    expect(source).toMatch(new RegExp(`if \\(!result\\.ok\\) \\{\\s*setError\\(result\\.error \\?\\? "Product could not be ${verb}`));
  });

  it("renders the error to the user", () => {
    expect(source).toMatch(/\{error \? <p className="text-sm text-destructive">\{error\}<\/p> : null\}/);
  });

  it("clears the error when the dialog is reopened/closed", () => {
    expect(source).toContain("setError(null)");
  });
});
