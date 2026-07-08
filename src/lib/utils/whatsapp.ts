import { formatBhd } from "@/lib/formatters/currency";
import { titleize } from "@/lib/formatters/labels";

type WhatsAppMessageParams = {
  customerName: string;
  orderNumber: string;
  grandTotal: number;
  paymentStatus: string;
  deliveryStatus: string | null;
};

/**
 * Builds a pre-filled WhatsApp order confirmation message.
 * Staff reviews the message before sending — never auto-sent.
 */
export function buildWhatsAppMessage(params: WhatsAppMessageParams): string {
  const lines: string[] = [
    `Hello ${params.customerName},`,
    ``,
    `Your order ${params.orderNumber} has been confirmed.`,
    `Total: ${formatBhd(params.grandTotal)}`,
    `Payment: ${titleize(params.paymentStatus)}`,
  ];

  if (params.deliveryStatus) {
    lines.push(`Delivery: ${titleize(params.deliveryStatus)}`);
  }

  lines.push(``, `Thank you for shopping with Moosiva Lux Wear!`);

  return lines.join("\n");
}

/**
 * Builds a wa.me URL with a pre-filled message.
 * Accepts raw or normalized Bahrain phone numbers.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("973") ? digits : `973${digits}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
