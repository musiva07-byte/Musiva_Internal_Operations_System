import { BrandMark } from "@/components/print/brand-mark";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDateTime } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";
import { formatBahrainPhone } from "@/lib/utils/phone";
import type { OrderWithRelations } from "@/types/app";

type InvoiceTemplateProps = {
  order: OrderWithRelations;
  compact?: boolean;
};

export function InvoiceTemplate({ order, compact = false }: InvoiceTemplateProps) {
  const payment = order.payments[0];
  const displayMobile =
    formatBahrainPhone(order.customer.mobile_normalized) ||
    formatBahrainPhone(order.customer.mobile) ||
    order.customer.mobile;

  return (
    <section className={compact ? "print-invoice-compact" : "print-page print-sheet"}>
      <header className="print-header">
        <BrandMark />
        <div className="text-right">
          <p className="text-xl font-semibold text-musiva-mauve">Receipt</p>
          <p className="mt-0.5 text-sm font-bold text-musiva-ink">{order.order_number}</p>
          <p className="text-xs text-musiva-muted">{formatDateTime(order.created_at)}</p>
        </div>
      </header>

      <div className="print-grid mt-5">
        <InfoBlock
          title="Customer"
          rows={[
            ["Name", order.customer.full_name],
            ["Mobile", displayMobile],
            ...(order.customer.whatsapp
              ? [["WhatsApp", formatBahrainPhone(order.customer.whatsapp_normalized) || order.customer.whatsapp] as [string, string]]
              : []),
          ]}
        />
        <InfoBlock
          title="Order"
          rows={[
            ["Source", titleize(order.order_source)],
            ["Payment", order.payment_method ? titleize(order.payment_method) : "—"],
            ["Status", titleize(order.payment_status)],
          ]}
        />
      </div>

      <table className="print-table mt-5">
        <thead>
          <tr>
            <th>Item</th>
            <th>Variant</th>
            <th className="text-center">Qty</th>
            <th className="text-right">Unit</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.product_name_snapshot}</strong>
                <span className="block text-xs text-musiva-muted">{item.variant_sku_snapshot}</span>
              </td>
              <td className="whitespace-nowrap">
                {item.color_snapshot} / {item.size_snapshot}
              </td>
              <td className="text-center">{item.quantity}</td>
              <td className="text-right">{formatBhd(item.unit_price)}</td>
              <td className="text-right font-medium">{formatBhd(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 grid grid-cols-2 gap-6">
        <div className="rounded-md border border-musiva-border p-3 text-xs">
          <p className="font-semibold text-musiva-mauve">Exchange &amp; Return Policy</p>
          <p className="mt-1.5 text-musiva-ink">
            Exchange is subject to boutique policy and item condition.
          </p>
          <p className="mt-3 text-musiva-muted">WhatsApp: +973 1700 0000</p>
          <p className="text-musiva-muted">Instagram: @moosiva_luxwear</p>
          {payment?.reference_number ? (
            <p className="mt-2 text-musiva-muted">
              Payment ref: {payment.reference_number}
            </p>
          ) : null}
        </div>
        <div className="ml-auto w-full space-y-1.5 text-sm">
          <TotalRow label="Subtotal" value={formatBhd(order.subtotal)} />
          {Number(order.discount_total) > 0 && (
            <TotalRow label="Discount" value={`− ${formatBhd(order.discount_total)}`} />
          )}
          {Number(order.delivery_charge) > 0 && (
            <TotalRow label="Delivery" value={formatBhd(order.delivery_charge)} />
          )}
          <TotalRow label="Grand Total" value={formatBhd(order.grand_total)} strong />
          <TotalRow label="Amount Paid" value={formatBhd(order.amount_paid)} />
          {Number(order.amount_due) > 0 && (
            <TotalRow label="Amount Due" value={formatBhd(order.amount_due)} strong />
          )}
        </div>
      </div>

      <footer className="mt-5 border-t border-musiva-border pt-3 text-center text-xs text-musiva-muted">
        Thank you for shopping with Moosiva Lux Wear.
      </footer>
    </section>
  );
}

function InfoBlock({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="rounded-md border border-musiva-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-musiva-mauve">{title}</p>
      <dl className="mt-2 space-y-1.5 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-musiva-muted">{label}</dt>
            <dd className="text-right font-medium text-musiva-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "flex justify-between border-t border-musiva-border pt-1.5 font-semibold"
          : "flex justify-between text-musiva-muted"
      }
    >
      <span>{label}</span>
      <span className={strong ? "text-musiva-ink" : ""}>{value}</span>
    </div>
  );
}
