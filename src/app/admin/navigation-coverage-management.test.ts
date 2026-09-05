/**
 * Structural regression guard for the second navigation/UX consistency pass covering the six
 * previously-unmigrated page groups: Suppliers, Purchases, Expenses, Staff, Settings, and
 * Returns & Exchanges. Same source-text-guard pattern as breadcrumb-navigation.test.ts and
 * navigation-coverage.test.ts (no rendering harness in this codebase).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(...segments: string[]): string {
  return readFileSync(join(__dirname, ...segments), "utf-8");
}

// ── Suppliers ──────────────────────────────────────────────────────────────────

describe("Suppliers list — PageHeader + breadcrumb + empty state", () => {
  const source = read("suppliers", "page.tsx");
  it("uses PageHeader with a Management > Suppliers breadcrumb", () => {
    expect(source).toContain("<PageHeader");
    expect(source).toContain('{ label: "Management" }, { label: "Suppliers" }');
  });
  it("has a clear primary action and a Clear filters empty state", () => {
    expect(source).toContain('href="/admin/suppliers/new"');
    expect(source).toContain("Clear filters");
  });
});

describe("Supplier detail — breadcrumb + back link", () => {
  const source = read("suppliers", "[id]", "page.tsx");
  it("renders a Management > Suppliers > {name} breadcrumb", () => {
    expect(source).toContain('{ label: "Suppliers", href: "/admin/suppliers" }');
    expect(source).toContain("{ label: supplier.supplier_name }");
  });
  it('has a "Back to suppliers" link', () => {
    expect(source).toContain('<BackLink href="/admin/suppliers" label="Back to suppliers" />');
  });
});

describe("Supplier edit — breadcrumb + back link", () => {
  const source = read("suppliers", "[id]", "edit", "page.tsx");
  it("renders a breadcrumb ending in Edit", () => {
    expect(source).toContain('{ label: "Edit" }');
  });
  it('has a "Back to supplier" link', () => {
    expect(source).toMatch(/<BackLink href=\{`\/admin\/suppliers\/\$\{supplier\.id\}`\} label="Back to supplier" \/>/);
  });
});

describe("New supplier — breadcrumb + back link", () => {
  const source = read("suppliers", "new", "page.tsx");
  it('has a "Back to suppliers" link', () => {
    expect(source).toContain('<BackLink href="/admin/suppliers" label="Back to suppliers" />');
  });
});

describe("SupplierForm — sticky footer + success feedback", () => {
  const source = readFileSync(
    join(__dirname, "..", "..", "components", "suppliers", "supplier-form.tsx"),
    "utf-8",
  );
  it("wraps Cancel/Save in StickyActionBar", () => {
    expect(source).toContain("StickyActionBar");
    expect(source).toContain("Cancel");
  });
  it("shows a SuccessDialog instead of a silent redirect", () => {
    expect(source).toContain("SuccessDialog");
    expect(source).toContain("Back to suppliers");
    expect(source).toContain("View supplier");
  });
});

// ── Purchases ──────────────────────────────────────────────────────────────────

describe("Purchases list — PageHeader + breadcrumb + empty state", () => {
  const source = read("purchases", "page.tsx");
  it("uses PageHeader with a Management > Purchases breadcrumb", () => {
    expect(source).toContain("<PageHeader");
    expect(source).toContain('{ label: "Management" }, { label: "Purchases" }');
  });
  it("has a clear primary action and a Clear filters empty state", () => {
    expect(source).toContain('href="/admin/purchases/new"');
    expect(source).toContain("Clear filters");
  });
});

describe("New purchase — breadcrumb + back link", () => {
  const source = read("purchases", "new", "page.tsx");
  it('has a "Back to purchases" link', () => {
    expect(source).toContain('<BackLink href="/admin/purchases" label="Back to purchases" />');
  });
});

describe("Purchase detail — breadcrumb + back link + cost permission preserved", () => {
  const source = read("purchases", "[id]", "page.tsx");
  it("renders a Management > Purchases > {number} breadcrumb", () => {
    expect(source).toContain('{ label: "Purchases", href: "/admin/purchases" }');
    expect(source).toContain("{ label: purchase.purchase_number }");
  });
  it('has a "Back to purchases" link', () => {
    expect(source).toContain('<BackLink href="/admin/purchases" label="Back to purchases" />');
  });
  it("still gates cost columns behind canViewCostData (showCost) — unchanged by navigation pass", () => {
    expect(source).toContain("canViewCostData");
    expect(source).toContain("const showCost = canViewCostData(profile?.role)");
    expect(source).toContain("{showCost ? (");
  });
  it("uses the feedback-aware MarkReceivedButton instead of a silent form action", () => {
    expect(source).toContain("MarkReceivedButton");
    expect(source).not.toContain("receivePurchaseFormAction");
  });
});

describe("MarkReceivedButton — success/error feedback", () => {
  const source = readFileSync(
    join(__dirname, "..", "..", "components", "purchases", "mark-received-button.tsx"),
    "utf-8",
  );
  it("shows friendly success and error feedback instead of a silent form post", () => {
    expect(source).toContain("setSuccess(true)");
    expect(source).toContain("setError(");
  });
});

describe("PurchaseForm — sticky footer + success feedback", () => {
  const source = readFileSync(
    join(__dirname, "..", "..", "components", "purchases", "purchase-form.tsx"),
    "utf-8",
  );
  it("wraps Cancel/Save in StickyActionBar", () => {
    expect(source).toContain("StickyActionBar");
  });
  it("shows a SuccessDialog instead of a silent redirect", () => {
    expect(source).toContain("SuccessDialog");
    expect(source).toContain("Back to purchases");
    expect(source).toContain("View purchase");
  });
});

// ── Expenses ───────────────────────────────────────────────────────────────────

describe("Expenses list — PageHeader + breadcrumb + empty state", () => {
  const source = read("expenses", "page.tsx");
  it("uses PageHeader with a Management > Expenses breadcrumb", () => {
    expect(source).toContain("<PageHeader");
    expect(source).toContain('{ label: "Management" }, { label: "Expenses" }');
  });
  it("has a clear primary action and a Clear filters empty state", () => {
    expect(source).toContain('href="/admin/expenses/new"');
    expect(source).toContain("Clear filters");
  });
});

describe("New expense — breadcrumb + back link", () => {
  const source = read("expenses", "new", "page.tsx");
  it('has a "Back to expenses" link', () => {
    expect(source).toContain('<BackLink href="/admin/expenses" label="Back to expenses" />');
  });
});

describe("Expense detail — breadcrumb + back link", () => {
  const source = read("expenses", "[id]", "page.tsx");
  it("renders a Management > Expenses > {amount} breadcrumb", () => {
    expect(source).toContain('{ label: "Expenses", href: "/admin/expenses" }');
  });
  it('has a "Back to expenses" link', () => {
    expect(source).toContain('<BackLink href="/admin/expenses" label="Back to expenses" />');
  });
});

describe("ExpenseForm — sticky footer + success feedback", () => {
  const source = readFileSync(
    join(__dirname, "..", "..", "components", "expenses", "expense-form.tsx"),
    "utf-8",
  );
  it("wraps Cancel/Save in StickyActionBar", () => {
    expect(source).toContain("StickyActionBar");
  });
  it("shows a SuccessDialog instead of a silent redirect", () => {
    expect(source).toContain("SuccessDialog");
    expect(source).toContain("Back to expenses");
    expect(source).toContain("View expense");
  });
});

// ── Staff ──────────────────────────────────────────────────────────────────────

describe("Staff list — PageHeader + breadcrumb + empty state", () => {
  const source = read("staff", "page.tsx");
  it("uses PageHeader with a Management > Staff & Roles breadcrumb", () => {
    expect(source).toContain("<PageHeader");
    expect(source).toContain('{ label: "Management" }, { label: "Staff & Roles" }');
  });
  it("has a clear primary action and a Clear filters empty state", () => {
    expect(source).toContain('href="/admin/staff/new"');
    expect(source).toContain("Clear filters");
  });
});

describe("New staff — breadcrumb + back link", () => {
  const source = read("staff", "new", "page.tsx");
  it('has a "Back to staff" link', () => {
    expect(source).toContain('<BackLink href="/admin/staff" label="Back to staff" />');
  });
});

describe("Staff detail — breadcrumb + back link", () => {
  const source = read("staff", "[id]", "page.tsx");
  it("renders a Management > Staff & Roles > {name} breadcrumb", () => {
    expect(source).toContain('{ label: "Staff & Roles", href: "/admin/staff" }');
    expect(source).toContain("{ label: profile.full_name }");
  });
  it('has a "Back to staff" link', () => {
    expect(source).toContain('<BackLink href="/admin/staff" label="Back to staff" />');
  });
});

describe("StaffForm — sticky footer + success feedback", () => {
  const source = readFileSync(join(__dirname, "..", "..", "components", "staff", "staff-form.tsx"), "utf-8");
  it("wraps Cancel/Save in StickyActionBar", () => {
    expect(source).toContain("StickyActionBar");
  });
  it("shows a SuccessDialog instead of a silent redirect", () => {
    expect(source).toContain("SuccessDialog");
    expect(source).toContain("Back to staff");
    expect(source).toContain("View staff profile");
  });
});

// ── Settings ───────────────────────────────────────────────────────────────────

describe("Settings — breadcrumb + link to System usage + exchange-rate gate preserved", () => {
  const source = read("settings", "page.tsx");
  it("uses PageHeader with a Settings breadcrumb", () => {
    expect(source).toContain("<PageHeader");
    expect(source).toContain('<Breadcrumb segments={[{ label: "Settings" }]} />');
  });
  it("links to the previously-orphaned System usage page", () => {
    expect(source).toContain('href="/admin/settings/system"');
  });
  it("still gates the exchange-rate card behind canManageExchangeRates — unchanged by navigation pass", () => {
    expect(source).toContain("canManageExchangeRates");
    expect(source).toContain("{canManageRates && (");
  });
});

describe("Settings > System — breadcrumb + back link", () => {
  const source = read("settings", "system", "page.tsx");
  it("renders a Settings > System breadcrumb", () => {
    expect(source).toContain('{ label: "Settings", href: "/admin/settings" }');
    expect(source).toContain('{ label: "System" }');
  });
  it('has a "Back to settings" link', () => {
    expect(source).toContain('<BackLink href="/admin/settings" label="Back to settings" />');
  });
});

describe("SettingsForm — sticky footer preserved, inline feedback kept", () => {
  const source = readFileSync(
    join(__dirname, "..", "..", "components", "settings", "settings-form.tsx"),
    "utf-8",
  );
  it("wraps the Save button in StickyActionBar", () => {
    expect(source).toContain("StickyActionBar");
  });
  it("keeps its existing inline success/error feedback (appropriate for a persistent settings page)", () => {
    expect(source).toContain("formMessage");
    expect(source).toContain("formError");
  });
});

// ── Returns & Exchanges ──────────────────────────────────────────────────────

describe("Returns list — PageHeader + Daily Work breadcrumb + empty state", () => {
  const source = read("returns", "page.tsx");
  it("uses PageHeader with a Daily Work > Returns & Exchanges breadcrumb", () => {
    expect(source).toContain("<PageHeader");
    expect(source).toContain('{ label: "Daily Work" }, { label: "Returns & Exchanges" }');
  });
  it("has a clear primary action and a Clear filters empty state", () => {
    expect(source).toContain('href="/admin/returns/new"');
    expect(source).toContain("Clear filters");
  });
});

describe("New return — breadcrumb + back link", () => {
  const source = read("returns", "new", "page.tsx");
  it('has a "Back to returns" link', () => {
    expect(source).toContain('<BackLink href="/admin/returns" label="Back to returns" />');
  });
});

describe("Return detail — breadcrumb + back link", () => {
  const source = read("returns", "[id]", "page.tsx");
  it("renders a Daily Work > Returns & Exchanges > {order number} breadcrumb", () => {
    expect(source).toContain('{ label: "Returns & Exchanges", href: "/admin/returns" }');
  });
  it('has a "Back to returns" link', () => {
    expect(source).toContain('<BackLink href="/admin/returns" label="Back to returns" />');
  });
});

describe("ReturnForm — sticky footer + success feedback", () => {
  const source = readFileSync(join(__dirname, "..", "..", "components", "returns", "return-form.tsx"), "utf-8");
  it("wraps Cancel/Save in StickyActionBar", () => {
    expect(source).toContain("StickyActionBar");
  });
  it("shows a SuccessDialog instead of a silent redirect", () => {
    expect(source).toContain("SuccessDialog");
    expect(source).toContain("Back to returns");
    expect(source).toContain("View return");
  });
});
