import { BrandMark } from "@/components/print/brand-mark";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";
import type { OrderWithRelations } from "@/types/app";

type LabelTemplateProps = {
  order: OrderWithRelations;
  compact?: boolean;
};

export function LabelTemplate({ order, compact = false }: LabelTemplateProps) {
  const delivery = order.delivery;
  const itemsSummary = order.items
    .map((item) => `${item.quantity}x ${item.product_name_snapshot} ${item.color_snapshot}/${item.size_snapshot}`)
    .join(", ");

  return (
    <section className={compact ? "print-label-compact" : "print-page print-sheet"}>
      <header className="print-header">
        <BrandMark />
        <div className="text-right">
          <p className="text-2xl font-black uppercase tracking-wide text-[#1F1F1F]">Delivery Label</p>
          <p className="mt-1 text-sm font-semibold text-[#BC408D]">{order.order_number}</p>
          <p className="text-xs text-[#6F6470]">{formatDate(order.created_at)}</p>
        </div>
      </header>

      <div className="mt-8 border-2 border-[#1F1F1F]">
        <div className="border-b-2 border-[#1F1F1F] bg-[#FAF7F9] p-4 text-center text-xl font-black tracking-wide">
          MUSIVA DELIVERY LABEL
        </div>
        <div className="grid grid-cols-2 border-b-2 border-[#1F1F1F]">
          <LabelCell label="Order Number" value={order.order_number} strong />
          <LabelCell label="Date" value={formatDate(order.created_at)} />
        </div>
        <div className="grid grid-cols-2 border-b-2 border-[#1F1F1F]">
          <LabelCell label="Customer Name" value={delivery?.customer_name ?? order.customer.full_name} strong />
          <LabelCell label="Mobile" value={delivery?.phone ?? order.customer.mobile} strong />
        </div>
        <div className="grid grid-cols-2 border-b-2 border-[#1F1F1F]">
          <LabelCell label="Governorate" value={delivery?.governorate ?? order.customer.governorate ?? "-"} />
          <LabelCell label="Area" value={delivery?.area ?? order.customer.area ?? "-"} />
        </div>
        <div className="grid grid-cols-4 border-b-2 border-[#1F1F1F]">
          <LabelCell label="Block" value={delivery?.block ?? order.customer.block ?? "-"} />
          <LabelCell label="Road" value={delivery?.road ?? order.customer.road ?? "-"} />
          <LabelCell label="Building" value={delivery?.building ?? order.customer.building ?? "-"} />
          <LabelCell label="Flat" value={delivery?.flat ?? order.customer.flat ?? "-"} />
        </div>
        <LabelWide label="Landmark" value={delivery?.landmark ?? order.customer.landmark ?? "-"} />
        <LabelWide label="Items Summary" value={itemsSummary || "-"} />
        <div className="grid grid-cols-2 border-b-2 border-[#1F1F1F]">
          <LabelCell label="Payment Status" value={titleize(order.payment_status)} />
          <LabelCell
            label="COD Amount / Amount to Collect"
            value={order.payment_status === "cod" || order.amount_due > 0 ? formatBhd(order.amount_due) : formatBhd(0)}
            strong
          />
        </div>
        <LabelWide label="Delivery Notes" value={delivery?.delivery_note ?? order.customer.delivery_notes ?? "-"} />
      </div>
    </section>
  );
}

function LabelCell({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-h-20 border-r-2 border-[#1F1F1F] p-3 last:border-r-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6F6470]">{label}</p>
      <p className={strong ? "mt-2 text-xl font-black text-[#1F1F1F]" : "mt-2 text-base font-semibold text-[#1F1F1F]"}>
        {value}
      </p>
    </div>
  );
}

function LabelWide({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b-2 border-[#1F1F1F] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6F6470]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[#1F1F1F]">{value}</p>
    </div>
  );
}
