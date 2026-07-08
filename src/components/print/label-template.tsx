import { BrandMark } from "@/components/print/brand-mark";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";
import { formatBahrainPhone } from "@/lib/utils/phone";
import type { OrderWithRelations } from "@/types/app";

type LabelTemplateProps = {
  order: OrderWithRelations;
  compact?: boolean;
};

export function LabelTemplate({ order, compact = false }: LabelTemplateProps) {
  const delivery = order.delivery;

  const isCod = order.payment_status === "cod" || Number(order.amount_due) > 0;
  const codAmount = Number(order.amount_due);

  const customerName = delivery?.customer_name ?? order.customer.full_name;
  const phone = delivery?.phone ?? order.customer.mobile_normalized ?? order.customer.mobile;
  const displayPhone = formatBahrainPhone(phone) || phone;

  const governorate = delivery?.governorate ?? order.customer.governorate ?? "";
  const area = delivery?.area ?? order.customer.area ?? "";
  const block = delivery?.block ?? order.customer.block ?? "";
  const road = delivery?.road ?? order.customer.road ?? "";
  const building = delivery?.building ?? order.customer.building ?? "";
  const flat = delivery?.flat ?? order.customer.flat ?? "";
  const landmark = delivery?.landmark ?? order.customer.landmark ?? "";
  const deliveryNote = delivery?.delivery_note ?? order.customer.delivery_notes ?? "";

  const itemsSummary = order.items
    .map((item) => `${item.quantity}× ${item.product_name_snapshot} (${item.color_snapshot}/${item.size_snapshot})`)
    .join(" | ");

  return (
    <section className={compact ? "print-label-compact" : "print-page print-sheet"}>
      <header className="print-header">
        <BrandMark />
        <div className="text-right">
          <p className="text-lg font-black uppercase tracking-wide text-musiva-ink">Delivery Label</p>
          <p className="mt-0.5 text-sm font-semibold text-musiva-mauve">{order.order_number}</p>
          <p className="text-xs text-musiva-muted">{formatDate(order.created_at)}</p>
        </div>
      </header>

      <div className="mt-4 border-2 border-[var(--brand-rose-deep)]">
        {/* Title bar */}
        <div className="border-b-2 border-[var(--brand-rose-deep)] bg-[var(--brand-blush)] px-4 py-2 text-center text-sm font-black uppercase tracking-widest text-[var(--brand-rose-deep)]">
          MUSIVA DELIVERY — {order.order_number}
        </div>

        {/* COD / Paid banner */}
        <div
          className={`border-b-2 border-[var(--brand-rose-deep)] px-4 py-3 text-center ${
            isCod
              ? "bg-[var(--status-warning)] text-white"
              : "bg-[var(--status-success)] text-white"
          }`}
        >
          {isCod ? (
            <p className="text-base font-black tracking-wide">
              AMOUNT TO COLLECT: {formatBhd(codAmount)}
            </p>
          ) : (
            <p className="text-base font-black tracking-wide">PAID — NOTHING TO COLLECT</p>
          )}
        </div>

        {/* Customer name + phone */}
        <div className="grid grid-cols-2 border-b-2 border-[var(--brand-rose-deep)]">
          <LabelCell label="Customer Name" value={customerName} size="xl" />
          <LabelCell label="Mobile" value={displayPhone} size="xl" />
        </div>

        {/* Governorate + Area */}
        <div className="grid grid-cols-2 border-b-2 border-[var(--brand-rose-deep)]">
          <LabelCell label="Governorate" value={governorate || "—"} size="lg" />
          <LabelCell label="Area" value={area || "—"} size="lg" />
        </div>

        {/* Block / Road / Building / Flat */}
        <div className="grid grid-cols-4 border-b-2 border-[var(--brand-rose-deep)]">
          <LabelCell label="Block" value={block || "—"} />
          <LabelCell label="Road" value={road || "—"} />
          <LabelCell label="Building" value={building || "—"} />
          <LabelCell label="Flat" value={flat || "—"} />
        </div>

        {/* Landmark */}
        {landmark && (
          <LabelWide label="Landmark" value={landmark} />
        )}

        {/* Items summary */}
        <LabelWide label="Items" value={itemsSummary || "—"} />

        {/* Payment status */}
        <div className="grid grid-cols-2 border-b-2 border-[var(--brand-rose-deep)]">
          <LabelCell label="Payment Status" value={titleize(order.payment_status)} />
          <LabelCell
            label={isCod ? "COD to Collect" : "Paid"}
            value={isCod ? formatBhd(codAmount) : formatBhd(order.amount_paid)}
            size="lg"
          />
        </div>

        {/* Delivery notes */}
        {deliveryNote && (
          <div className="px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-musiva-muted">
              Delivery Notes
            </p>
            <p className="mt-1 text-sm text-musiva-ink">{deliveryNote}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function LabelCell({
  label,
  value,
  size = "base",
}: {
  label: string;
  value: string;
  size?: "base" | "lg" | "xl";
}) {
  const sizeClass =
    size === "xl"
      ? "text-xl font-black"
      : size === "lg"
        ? "text-lg font-bold"
        : "text-base font-semibold";

  return (
    <div className="min-h-16 border-r-2 border-[var(--brand-rose-deep)] p-2.5 last:border-r-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-musiva-muted">{label}</p>
      <p className={`mt-1 break-words text-musiva-ink ${sizeClass}`}>{value}</p>
    </div>
  );
}

function LabelWide({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b-2 border-[var(--brand-rose-deep)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-musiva-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-musiva-ink">{value}</p>
    </div>
  );
}
