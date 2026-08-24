import { notFound } from "next/navigation";
import { OrderEditForm } from "@/components/orders/order-edit-form";
import { OrderItemsEditor } from "@/components/orders/order-items-editor";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BackLink } from "@/components/layout/back-link";
import { getOrder, listOrderableVariants } from "@/lib/services/order.service";
import { getCurrentAuthState } from "@/lib/auth/session";
import { canManageOrders, canEditCompletedOrderItems } from "@/lib/auth/permissions";
import { ORDER_COMPLETED_STATUSES, ORDER_STATUSES } from "@/lib/constants";

type EditOrderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditOrderPage({ params }: EditOrderPageProps) {
  const { id } = await params;
  const [order, { profile }, variants] = await Promise.all([
    getOrder(id),
    getCurrentAuthState(),
    listOrderableVariants(),
  ]);

  if (!order) {
    notFound();
  }

  const role = profile?.role ?? null;

  if (!canManageOrders(role)) {
    return (
      <div className="space-y-6">
        <header>
          <Breadcrumb
            segments={[
              { label: "Orders", href: "/admin/orders" },
              { label: order.order_number, href: `/admin/orders/${order.id}` },
              { label: "Edit" },
            ]}
          />
          <div className="mt-2">
            <BackLink href={`/admin/orders/${order.id}`} label="Back to order" />
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Edit {order.order_number}</h1>
        </header>
        <p className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          You do not have permission to edit orders.
        </p>
      </div>
    );
  }

  const requiresElevatedPermission =
    order.order_status === ORDER_STATUSES.cancelled
      ? false
      : ORDER_COMPLETED_STATUSES.has(order.order_status) || order.delivery?.delivery_status === "delivered";

  return (
    <div className="space-y-6">
      <header>
        <Breadcrumb
          segments={[
            { label: "Orders", href: "/admin/orders" },
            { label: order.order_number, href: `/admin/orders/${order.id}` },
            { label: "Edit" },
          ]}
        />
        <div className="mt-2">
          <BackLink href={`/admin/orders/${order.id}`} label="Back to order" />
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Edit {order.order_number}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Update order and payment statuses, or change item variant/size/color/quantity below.
        </p>
      </header>
      {order.order_status !== ORDER_STATUSES.cancelled && (
        <OrderItemsEditor
          order={order}
          variants={variants}
          requiresElevatedPermission={Boolean(requiresElevatedPermission)}
          canEditElevated={canEditCompletedOrderItems(role)}
        />
      )}
      <OrderEditForm order={order} />
    </div>
  );
}
