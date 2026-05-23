import { BrandMark } from "@/components/print/brand-mark";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDateTime } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";
import type { OrderWithRelations } from "@/types/app";

type InvoiceTemplateProps = {
  order: OrderWithRelations;
  compact?: boolean;
};

export function InvoiceTemplate({ order, compact = false }: InvoiceTemplateProps) {
  const payment = order.payments[0];

  return (
    <section className={compact ? "print-invoice-compact" : "print-page print-sheet"}>
      <header className="print-header">
        <BrandMark />
        <div className="text-right">
          <p className="text-2xl font-semibold text-[#BC408D]">Invoice</p>
          <p className="mt-1 text-sm font-medium">{order.order_number}</p>
          <p className="text-xs text-[#6F6470]">{formatDateTime(order.created_at)}</p>
        </div>
      </header>

      <div className="print-grid mt-8">
        <InfoBlock
          title="Customer"
          rows={[
            ["Name", order.customer.full_name],
            ["Mobile", order.customer.mobile],
            ["WhatsApp", order.customer.whatsapp ?? "-"],
            ["Email", order.customer.email ?? "-"],
          ]}
        />
        <InfoBlock
          title="Order"
          rows={[
            ["Source", titleize(order.order_source)],
            ["Staff", order.staff_id ?? "-"],
            ["Payment Method", order.payment_method ? titleize(order.payment_method) : "-"],
            ["Payment Status", titleize(order.payment_status)],
          ]}
        />
      </div>

      <table className="print-table mt-8">
        <thead>
          <tr>
            <th>Item</th>
            <th>Variant</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Discount</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.product_name_snapshot}</strong>
                <span className="block text-xs text-[#6F6470]">{item.variant_sku_snapshot}</span>
              </td>
              <td>
                {item.color_snapshot} / {item.size_snapshot}
              </td>
              <td>{item.quantity}</td>
              <td>{formatBhd(item.unit_price)}</td>
              <td>{formatBhd(item.discount)}</td>
              <td className="text-right">{formatBhd(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-8 grid grid-cols-2 gap-8">
        <div className="rounded-md border border-[#E8DCE5] p-4 text-sm">
          <p className="font-semibold text-[#BC408D]">Return and exchange note</p>
          <p className="mt-2 text-[#1F1F1F]">
            Exchange is subject to boutique policy and item condition.
          </p>
          <p className="mt-4 text-[#6F6470]">WhatsApp: +973 XXXX XXXX</p>
          <p className="text-[#6F6470]">Instagram: @moosiva_luxwear</p>
          {payment?.reference_number ? (
            <p className="mt-3 text-[#6F6470]">Payment reference: {payment.reference_number}</p>
          ) : null}
        </div>
        <div className="ml-auto w-full max-w-xs space-y-2 text-sm">
          <TotalRow label="Subtotal" value={formatBhd(order.subtotal)} />
          <TotalRow label="Discount" value={formatBhd(order.discount_total)} />
          <TotalRow label="Delivery" value={formatBhd(order.delivery_charge)} />
          <TotalRow label="Grand Total" value={formatBhd(order.grand_total)} strong />
          <TotalRow label="Amount Paid" value={formatBhd(order.amount_paid)} />
          <TotalRow label="Amount Due" value={formatBhd(order.amount_due)} strong />
        </div>
      </div>

      <footer className="mt-8 border-t border-[#E8DCE5] pt-4 text-center text-xs text-[#6F6470]">
        Thank you for shopping with Moosiva Lux Wear.
      </footer>
    </section>
  );
}

function InfoBlock({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="rounded-md border border-[#E8DCE5] p-4">
      <p className="text-sm font-semibold text-[#BC408D]">{title}</p>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-[#6F6470]">{label}</dt>
            <dd className="text-right font-medium text-[#1F1F1F]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TotalRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between border-t border-[#E8DCE5] pt-2 text-base font-semibold" : "flex justify-between"}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
