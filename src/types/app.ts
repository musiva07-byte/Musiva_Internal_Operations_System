import type {
  CategoryRow,
  CustomerAddressRow,
  CustomerRow,
  DeliveryRow,
  DeliveryStatusHistoryRow,
  ExchangeRateRow,
  InventoryBatchRow,
  OrderItemRow,
  OrderRow,
  PaymentRow,
  PricingStatus,
  ProductImageRow,
  ProductRow,
  ProductVariantRow,
  PurchaseOrderItemRow,
  PurchaseOrderRow,
  ReturnItemRow,
  ReturnRow,
  StockMovementRow,
  StockStatus,
  SupplierRow,
} from "./database";

export type ProductWithRelations = ProductRow & {
  category: Pick<CategoryRow, "id" | "name"> | null;
  variants: ProductVariantRow[];
  images: ProductImageRow[];
};

export type VariantQuick = {
  id: string;
  color: string;
  size: string;
  stock_quantity: number;
};

export type ProductListItem = ProductRow & {
  category_name: string | null;
  primary_image_url: string | null;
  variant_count: number;
  total_stock: number;
  low_stock_count: number;
  out_of_stock_count: number;
  min_selling_price: number | null;
  /** True when any variant currently has an active discount. */
  has_active_discount: boolean;
  /** Minimal variant data for quick-action dialogs. */
  variants_quick: VariantQuick[];
  /** True when the product satisfies all required-for-publishing checks (see lib/validations/product-publishing.ts). */
  website_ready: boolean;
};

export type InventoryVariantItem = ProductVariantRow & {
  product_name: string;
  product_sku: string;
  category_name: string | null;
  primary_image_url: string | null;
  /** Computed stock status (in_stock / low_stock / out_of_stock). */
  stock_status: StockStatus;
  /** Currently active selling price (discount or regular). */
  active_selling_price: number;
  /** Computed pricing status. */
  pricing_status: PricingStatus;
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

export type CustomerWithAddresses = CustomerRow & {
  addresses: CustomerAddressRow[];
};

/** Returned by the mobile-search endpoint in the New Sale wizard. */
export type CustomerSearchResult = {
  customer: CustomerRow;
  addresses: CustomerAddressRow[];
  order_count: number;
  last_order_at: string | null;
  total_spending: number;
} | null;

export type OrderListItem = OrderRow & {
  customer_name: string;
  customer_mobile: string;
  item_count: number;
  /** ID of the linked delivery record, if any. Null for walk-in / pickup orders. */
  delivery_id: string | null;
  /** Current status of the linked delivery record, for in-line display on in-fulfilment orders. */
  delivery_status: string | null;
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
  /** Fulfilment method from the linked order, for display/routing decisions. */
  fulfilment_method: string;
};

export type DeliveryWithOrder = DeliveryRow & {
  order: OrderWithRelations;
};

export type DeliveryListItemWithHistory = DeliveryRow & {
  order_number: string;
  payment_status: string;
  amount_due: number;
  grand_total: number;
  customer_name: string;
  fulfilment_method: string;
  history: DeliveryStatusHistoryRow[];
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

export type InventoryBatchWithVariant = InventoryBatchRow & {
  product_name: string;
  variant_sku: string;
  color: string;
  size: string;
};

export { CustomerAddressRow, DeliveryStatusHistoryRow, ExchangeRateRow };

export type PaginatedResult<T> = {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  pageCount: number;
  loadError?: string;
};

export type OrderTabCounts = {
  today: number;
  new: number;
  confirmed: number;
  in_fulfilment: number;
  completed: number;
  cancelled: number;
  all: number;
};

export type DeliveryTabCounts = {
  today: number;
  pending: number;
  packed: number;
  ready: number;
  out_for_delivery: number;
  failed: number;
  delivered: number;
  all: number;
};
