import { describe, it, expect } from "vitest";
import {
  getConvertToOrderViewState,
  getStatusHelperNote,
  getVisibleNextStatuses,
  requiresConfirmation,
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

  it("tells inventory staff (who cannot convert) a confirmed request is ready for Convert to Order", () => {
    expect(getStatusHelperNote("confirmed", "inventory_staff")).toBe("Ready for Convert to Order");
  });

  it("shows no confirmed-status note for roles that can actually convert (owner/manager/sales_staff)", () => {
    expect(getStatusHelperNote("confirmed", "owner")).toBeNull();
    expect(getStatusHelperNote("confirmed", "manager")).toBeNull();
    expect(getStatusHelperNote("confirmed", "sales_staff")).toBeNull();
  });

  it("shows no contacted-status note for owner/manager, who get real action buttons instead", () => {
    expect(getStatusHelperNote("contacted", "owner")).toBeNull();
    expect(getStatusHelperNote("contacted", "manager")).toBeNull();
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

describe("getConvertToOrderViewState", () => {
  it("shows the converted state whenever an order is already linked, regardless of status", () => {
    expect(getConvertToOrderViewState("confirmed", true, "order-1")).toBe("converted");
    expect(getConvertToOrderViewState("new", true, "order-1")).toBe("converted");
    expect(getConvertToOrderViewState("cancelled", false, "order-1")).toBe("converted");
  });

  it("blocks cancelled requests from ever being converted", () => {
    expect(getConvertToOrderViewState("cancelled", true, null)).toBe("cancelled");
  });

  it("asks for confirmation first when the request is new or contacted", () => {
    expect(getConvertToOrderViewState("new", true, null)).toBe("needs_confirmation");
    expect(getConvertToOrderViewState("contacted", true, null)).toBe("needs_confirmation");
  });

  it("hides the button for a confirmed request when the viewer cannot convert", () => {
    expect(getConvertToOrderViewState("confirmed", false, null)).toBe("no_permission");
  });

  it("is ready only when confirmed, unconverted, and the viewer can convert", () => {
    expect(getConvertToOrderViewState("confirmed", true, null)).toBe("ready");
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
