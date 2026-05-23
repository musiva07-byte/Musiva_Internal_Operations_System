import { notFound } from "next/navigation";
import { OrderEditForm } from "@/components/orders/order-edit-form";
import { getOrder } from "@/lib/services/order.service";

type EditOrderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditOrderPage({ params }: EditOrderPageProps) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Orders</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Edit {order.order_number}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Update order and payment statuses. Product quantities are locked after creation.
        </p>
      </header>
      <OrderEditForm order={order} />
    </div>
  );
}
