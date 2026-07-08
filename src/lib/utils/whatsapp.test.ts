import { describe, expect, it } from "vitest";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "./whatsapp";

// ── buildWhatsAppMessage ──────────────────────────────────────────────────────

describe("buildWhatsAppMessage", () => {
  it("includes customer name", () => {
    const msg = buildWhatsAppMessage({
      customerName: "Fatima Al Rashidi",
      orderNumber: "MSV-10006",
      grandTotal: 11.0,
      paymentStatus: "unpaid",
      deliveryStatus: null,
    });
    expect(msg).toContain("Fatima Al Rashidi");
  });

  it("includes order number", () => {
    const msg = buildWhatsAppMessage({
      customerName: "Jane",
      orderNumber: "MSV-10006",
      grandTotal: 11.0,
      paymentStatus: "paid",
      deliveryStatus: null,
    });
    expect(msg).toContain("MSV-10006");
  });

  it("formats grand total in BHD", () => {
    const msg = buildWhatsAppMessage({
      customerName: "Jane",
      orderNumber: "MSV-10001",
      grandTotal: 11.0,
      paymentStatus: "paid",
      deliveryStatus: null,
    });
    expect(msg).toContain("BHD 11.000");
  });

  it("includes payment status (titleized)", () => {
    const msg = buildWhatsAppMessage({
      customerName: "Jane",
      orderNumber: "MSV-10001",
      grandTotal: 5.0,
      paymentStatus: "unpaid",
      deliveryStatus: null,
    });
    expect(msg).toContain("Unpaid");
  });

  it("includes delivery status when provided", () => {
    const msg = buildWhatsAppMessage({
      customerName: "Jane",
      orderNumber: "MSV-10001",
      grandTotal: 5.0,
      paymentStatus: "paid",
      deliveryStatus: "pending",
    });
    expect(msg).toContain("Pending");
  });

  it("does NOT include delivery line when deliveryStatus is null", () => {
    const msg = buildWhatsAppMessage({
      customerName: "Jane",
      orderNumber: "MSV-10001",
      grandTotal: 5.0,
      paymentStatus: "paid",
      deliveryStatus: null,
    });
    expect(msg).not.toContain("Delivery:");
  });

  it("includes brand sign-off", () => {
    const msg = buildWhatsAppMessage({
      customerName: "Jane",
      orderNumber: "MSV-10001",
      grandTotal: 5.0,
      paymentStatus: "paid",
      deliveryStatus: null,
    });
    expect(msg).toContain("Moosiva Lux Wear");
  });

  it("contains correct order snapshot for Arabic customer name", () => {
    const msg = buildWhatsAppMessage({
      customerName: "فاطمة علي",
      orderNumber: "MSV-10009",
      grandTotal: 22.5,
      paymentStatus: "cod",
      deliveryStatus: "pending",
    });
    expect(msg).toContain("فاطمة علي");
    expect(msg).toContain("MSV-10009");
    expect(msg).toContain("BHD 22.500");
    expect(msg).toContain("Cod"); // titleize("cod") = "Cod"
    expect(msg).toContain("Pending");
  });
});

// ── buildWhatsAppUrl ──────────────────────────────────────────────────────────

describe("buildWhatsAppUrl", () => {
  it("builds a wa.me URL", () => {
    const url = buildWhatsAppUrl("33331101", "Hello");
    expect(url).toMatch(/^https:\/\/wa\.me\/973/);
  });

  it("prepends 973 to 8-digit number", () => {
    const url = buildWhatsAppUrl("33331101", "Test");
    expect(url).toContain("wa.me/97333331101");
  });

  it("does NOT double-prepend 973", () => {
    const url = buildWhatsAppUrl("97333331101", "Test");
    expect(url).toContain("wa.me/97333331101");
    expect(url).not.toContain("973973");
  });

  it("strips non-digits from formatted number", () => {
    const url = buildWhatsAppUrl("+973 3333 1101", "Hi");
    expect(url).toContain("wa.me/97333331101");
  });

  it("URL-encodes the message", () => {
    const url = buildWhatsAppUrl("33331101", "Hello World");
    expect(url).toContain("text=Hello%20World");
  });

  it("URL encodes newlines in multi-line message", () => {
    const url = buildWhatsAppUrl("33331101", "Line1\nLine2");
    expect(url).toContain("text=");
    expect(url).not.toContain("\n");
  });
});
