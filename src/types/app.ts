import type {
  CategoryRow,
  CustomerRow,
  DeliveryRow,
  OrderItemRow,
  OrderRow,
  PaymentRow,
  ProductImageRow,
  ProductRow,
  ProductVariantRow,
  PurchaseOrderItemRow,
  PurchaseOrderRow,
  ReturnItemRow,
  ReturnRow,
  StockMovementRow,
  SupplierRow,
} from "./database";

export type ProductWithRelations = ProductRow & {
  category: Pick<CategoryRow, "id" | "name"> | null;
  variants: ProductVariantRow[];
  images: ProductImageRow[];
};

export type ProductListItem = ProductRow & {
  category_name: string | null;
  primary_image_url: string | null;
  variant_count: number;
  total_stock: number;
  low_stock_count: number;
  out_of_stock_count: number;
  min_selling_price: number | null;
};

export type InventoryVariantItem = ProductVariantRow & {
  product_name: string;
  product_sku: string;
  category_name: string | null;
};

export type StockMovementItem = StockMovementRow & {
  product_name: string;
  variant_sku: string;
  color: string;
  size: string;
};

export type CustomerListItem = CustomerRow & {
  order_count: number;
  total_spending: number;
  last_order_at: string | null;
};

export type CustomerWithOrders = CustomerRow & {
  orders: OrderRow[];
};

export type OrderListItem = OrderRow & {
  customer_name: string;
  customer_mobile: string;
  item_count: number;
};

export type OrderWithRelations = OrderRow & {
  customer: CustomerRow;
  items: OrderItemRow[];
  payments: PaymentRow[];
  delivery: DeliveryRow | null;
};

export type OrderableVariantItem = ProductVariantRow & {
  product_name: string;
  product_sku: string;
};

export type DeliveryListItem = DeliveryRow & {
  order_number: string;
  payment_status: string;
  amount_due: number;
  grand_total: number;
};

export type DeliveryWithOrder = DeliveryRow & {
  order: OrderWithRelations;
};

export type ReturnListItem = ReturnRow & {
  order_number: string;
  customer_name: string;
  customer_mobile: string;
  item_count: number;
};

export type ReturnItemWithSnapshot = ReturnItemRow & {
  product_name_snapshot: string;
  variant_sku_snapshot: string;
  size_snapshot: string;
  color_snapshot: string;
};

export type ReturnWithRelations = ReturnRow & {
  order: OrderRow;
  customer: CustomerRow;
  items: ReturnItemWithSnapshot[];
};

export type SupplierListItem = SupplierRow & {
  purchase_count: number;
  total_purchase_value: number;
  last_purchase_date: string | null;
};

export type SupplierWithPurchases = SupplierRow & {
  purchases: PurchaseOrderRow[];
};

export type PurchaseListItem = PurchaseOrderRow & {
  supplier_name: string;
  item_count: number;
  received_units: number;
};

export type PurchaseItemWithVariant = PurchaseOrderItemRow & {
  product_name: string;
  variant_sku: string;
  color: string;
  size: string;
};

export type PurchaseWithRelations = PurchaseOrderRow & {
  supplier: SupplierRow;
  items: PurchaseItemWithVariant[];
};

export type PurchasableVariantItem = ProductVariantRow & {
  product_name: string;
  product_sku: string;
};

export type PaginatedResult<T> = {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  pageCount: number;
};
