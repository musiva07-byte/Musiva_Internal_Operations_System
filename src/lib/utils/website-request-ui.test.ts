import { describe, it, expect } from "vitest";
import {
  getStatusHelperNote,
  getVisibleNextStatuses,
  requiresConfirmation,
  showConvertToOrderPlaceholder,
} from "./website-request-ui";

describe("requiresConfirmation", () => {
  it("requires confirmation only for cancelling", () => {
    expect(requiresConfirmation("cancelled")).toBe(true);
    expect(requiresConfirmation("contacted")).toBe(false);
    expect(requiresConfirmation("confirmed")).toBe(false);
    expect(requiresConfirmation("new")).toBe(false);
  });
});

describe("getStatusHelperNote", () => {
  it("tells sales/inventory staff a contacted request is waiting on a manager", () => {
    expect(getStatusHelperNote("contacted", "sales_staff")).toBe("Waiting for manager confirmation");
    expect(getStatusHelperNote("contacted", "inventory_staff")).toBe("Waiting for manager confirmation");
  });

  it("tells sales/inventory staff a confirmed request is ready for Convert to Order", () => {
    expect(getStatusHelperNote("confirmed", "sales_staff")).toBe("Ready for Convert to Order");
    expect(getStatusHelperNote("confirmed", "inventory_staff")).toBe("Ready for Convert to Order");
  });

  it("shows no note for owner/manager, who get real action buttons instead", () => {
    expect(getStatusHelperNote("contacted", "owner")).toBeNull();
    expect(getStatusHelperNote("contacted", "manager")).toBeNull();
    expect(getStatusHelperNote("confirmed", "owner")).toBeNull();
    expect(getStatusHelperNote("confirmed", "manager")).toBeNull();
  });

  it("shows no note for new/cancelled regardless of role", () => {
    expect(getStatusHelperNote("new", "sales_staff")).toBeNull();
    expect(getStatusHelperNote("cancelled", "sales_staff")).toBeNull();
  });

  it("shows no note for a null/unauthenticated role", () => {
    expect(getStatusHelperNote("contacted", null)).toBe("Waiting for manager confirmation");
    expect(getStatusHelperNote("new", null)).toBeNull();
  });
});

describe("showConvertToOrderPlaceholder", () => {
  it("shows the placeholder to owner/manager only on a confirmed request", () => {
    expect(showConvertToOrderPlaceholder("confirmed", "owner")).toBe(true);
    expect(showConvertToOrderPlaceholder("confirmed", "manager")).toBe(true);
  });

  it("hides the placeholder for other roles or other statuses", () => {
    expect(showConvertToOrderPlaceholder("confirmed", "sales_staff")).toBe(false);
    expect(showConvertToOrderPlaceholder("confirmed", "inventory_staff")).toBe(false);
    expect(showConvertToOrderPlaceholder("new", "owner")).toBe(false);
    expect(showConvertToOrderPlaceholder("contacted", "owner")).toBe(false);
    expect(showConvertToOrderPlaceholder("cancelled", "owner")).toBe(false);
  });
});

describe("getVisibleNextStatuses", () => {
  it("hides 'cancelled' once a request is confirmed, even if the server would allow it", () => {
    expect(getVisibleNextStatuses("confirmed", ["cancelled"])).toEqual([]);
  });

  it("passes through unchanged for every other status", () => {
    expect(getVisibleNextStatuses("new", ["contacted", "confirmed", "cancelled"])).toEqual([
      "contacted",
      "confirmed",
      "cancelled",
    ]);
    expect(getVisibleNextStatuses("contacted", ["confirmed", "cancelled"])).toEqual([
      "confirmed",
      "cancelled",
    ]);
    expect(getVisibleNextStatuses("cancelled", ["new"])).toEqual(["new"]);
  });

  it("returns an empty array unchanged", () => {
    expect(getVisibleNextStatuses("confirmed", [])).toEqual([]);
    expect(getVisibleNextStatuses("new", [])).toEqual([]);
  });
});
