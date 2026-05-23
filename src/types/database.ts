export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type TableDefinition<Row, Insert = Row, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: never[];
};

type Insertable<Row> = Omit<Row, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

type InsertableCreated<Row> = Omit<Row, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type ProductStatus = "active" | "inactive" | "archived";
export type StockMovementType =
  | "opening_stock"
  | "purchase_stock"
  | "sale_deduction"
  | "return_added"
  | "exchange_deduction"
  | "damaged"
  | "manual_adjustment"
  | "cancelled_order_restore";
export type OrderSource = "instagram" | "whatsapp" | "website" | "walk_in" | "tiktok" | "referral" | "other";
export type OrderStatus =
  | "new"
  | "confirmed"
  | "packed"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned"
  | "exchange_requested";
export type PaymentMethod = "cash" | "benefitpay" | "card" | "bank_transfer" | "payment_link" | "cash_on_delivery";
export type PaymentStatus = "unpaid" | "paid" | "partial" | "cod" | "refunded";
export type DeliveryStatus =
  | "pending"
  | "packed"
  | "ready_for_pickup"
  | "with_courier"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "returned";
export type ReturnType = "return" | "exchange";
export type ReturnReason =
  | "size_issue"
  | "color_issue"
  | "damaged_item"
  | "wrong_item_sent"
  | "customer_changed_mind"
  | "delivery_failed"
  | "other";
export type ReturnCondition = "sellable" | "damaged" | "needs_review";
export type ReturnStatus = "pending" | "approved" | "completed" | "cancelled";
export type ReturnItemAction =
  | "add_back_to_stock"
  | "mark_damaged"
  | "exchange"
  | "refund_only"
  | "no_stock_change";
export type PurchaseStatus = "draft" | "ordered" | "partially_received" | "received" | "cancelled";
export type PurchasePaymentStatus = "unpaid" | "partial" | "paid";
export type ExpenseCategory =
  | "product_purchase"
  | "packaging"
  | "delivery"
  | "marketing"
  | "rent"
  | "staff_salary"
  | "utilities"
  | "software"
  | "miscellaneous";
export type StaffRole = "owner" | "manager" | "sales_staff" | "inventory_staff" | "accountant" | "delivery_coordinator";
export type StaffStatus = "active" | "inactive";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProductStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  category_id: string | null;
  collection: string | null;
  description: string | null;
  material: string | null;
  care_instructions: string | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
};

export type ProductVariantRow = {
  id: string;
  product_id: string;
  variant_sku: string;
  barcode: string | null;
  color: string;
  size: string;
  cost_price: number;
  selling_price: number;
  discount_price: number | null;
  stock_quantity: number;
  minimum_stock: number;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
};

export type ProductImageRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  url: string;
  path: string;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
};

export type StockMovementRow = {
  id: string;
  product_variant_id: string;
  movement_type: StockMovementType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type CustomerRow = {
  id: string;
  full_name: string;
  mobile: string;
  whatsapp: string | null;
  email: string | null;
  area: string | null;
  governorate: string | null;
  block: string | null;
  road: string | null;
  building: string | null;
  flat: string | null;
  landmark: string | null;
  delivery_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string;
  order_source: OrderSource;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  subtotal: number;
  discount_total: number;
  delivery_charge: number;
  grand_total: number;
  amount_paid: number;
  amount_due: number;
  staff_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_variant_id: string;
  product_name_snapshot: string;
  variant_sku_snapshot: string;
  size_snapshot: string;
  color_snapshot: string;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  order_id: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  amount: number;
  reference_number: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type DeliveryRow = {
  id: string;
  order_id: string;
  customer_name: string;
  phone: string;
  governorate: string | null;
  area: string | null;
  block: string | null;
  road: string | null;
  building: string | null;
  flat: string | null;
  landmark: string | null;
  delivery_note: string | null;
  delivery_date: string | null;
  delivery_time_slot: string | null;
  courier_name: string | null;
  courier_phone: string | null;
  delivery_status: DeliveryStatus;
  created_at: string;
  updated_at: string;
};

export type AuditLogRow = {
  id: string;
  action: string;
  table_name: string | null;
  record_id: string | null;
  user_id: string | null;
  metadata: Json;
  created_at: string;
};

export type ReturnRow = {
  id: string;
  original_order_id: string;
  customer_id: string;
  return_type: ReturnType;
  reason: ReturnReason;
  condition: ReturnCondition;
  refund_amount: number;
  exchange_order_id: string | null;
  status: ReturnStatus;
  staff_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ReturnItemRow = {
  id: string;
  return_id: string;
  product_variant_id: string;
  quantity: number;
  action: ReturnItemAction;
  created_at: string;
};

export type SupplierRow = {
  id: string;
  supplier_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseOrderRow = {
  id: string;
  purchase_number: string;
  supplier_id: string;
  purchase_date: string;
  expected_arrival_date: string | null;
  actual_arrival_date: string | null;
  status: PurchaseStatus;
  payment_status: PurchasePaymentStatus;
  subtotal: number;
  discount: number;
  shipping_cost: number;
  grand_total: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseOrderItemRow = {
  id: string;
  purchase_order_id: string;
  product_variant_id: string;
  quantity_ordered: number;
  quantity_received: number;
  cost_price: number;
  line_total: number;
  created_at: string;
};

export type ExpenseRow = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  payment_method: PaymentMethod;
  vendor: string | null;
  notes: string | null;
  attachment_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RoleRow = {
  id: string;
  name: StaffRole;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type PermissionRow = {
  id: string;
  permission_key: string;
  description: string | null;
  created_at: string;
};

export type RolePermissionRow = {
  role_id: string;
  permission_id: string;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  status: StaffStatus;
  created_at: string;
  updated_at: string;
};

export type SettingsRow = {
  id: string;
  business_name: string;
  logo_url: string | null;
  logo_path: string | null;
  whatsapp_number: string | null;
  instagram_handle: string | null;
  business_address: string | null;
  invoice_footer: string;
  return_policy_text: string;
  default_delivery_charge: number;
  currency: string;
  low_stock_default_quantity: number;
  receipt_theme: string;
  created_at: string;
  updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      categories: TableDefinition<CategoryRow, Insertable<CategoryRow>>;
      products: TableDefinition<ProductRow, Insertable<ProductRow>>;
      product_variants: TableDefinition<ProductVariantRow, Insertable<ProductVariantRow>>;
      product_images: TableDefinition<ProductImageRow, InsertableCreated<ProductImageRow>>;
      stock_movements: TableDefinition<StockMovementRow, InsertableCreated<StockMovementRow>>;
      customers: TableDefinition<CustomerRow, Insertable<CustomerRow>>;
      orders: TableDefinition<
        OrderRow,
        Omit<OrderRow, "id" | "order_number" | "created_at" | "updated_at"> & {
          id?: string;
          order_number?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      order_items: TableDefinition<OrderItemRow, InsertableCreated<OrderItemRow>>;
      payments: TableDefinition<PaymentRow, InsertableCreated<PaymentRow>>;
      deliveries: TableDefinition<DeliveryRow, Insertable<DeliveryRow>>;
      audit_logs: TableDefinition<AuditLogRow, InsertableCreated<AuditLogRow>>;
      returns: TableDefinition<ReturnRow, Insertable<ReturnRow>>;
      return_items: TableDefinition<ReturnItemRow, InsertableCreated<ReturnItemRow>>;
      suppliers: TableDefinition<SupplierRow, Insertable<SupplierRow>>;
      purchase_orders: TableDefinition<
        PurchaseOrderRow,
        Omit<PurchaseOrderRow, "id" | "purchase_number" | "created_at" | "updated_at"> & {
          id?: string;
          purchase_number?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      purchase_order_items: TableDefinition<PurchaseOrderItemRow, InsertableCreated<PurchaseOrderItemRow>>;
      expenses: TableDefinition<ExpenseRow, Insertable<ExpenseRow>>;
      roles: TableDefinition<RoleRow, Insertable<RoleRow>>;
      permissions: TableDefinition<PermissionRow, InsertableCreated<PermissionRow>>;
      role_permissions: TableDefinition<RolePermissionRow, RolePermissionRow>;
      profiles: TableDefinition<ProfileRow, ProfileRow>;
      settings: TableDefinition<SettingsRow, Insertable<SettingsRow>>;
    };
    Views: Record<string, never>;
    Functions: {
      add_variant_stock: {
        Args: {
          p_variant_id: string;
          p_quantity: number;
          p_movement_type: StockMovementType;
          p_reference_type?: string | null;
          p_reference_id?: string | null;
          p_note?: string | null;
        };
        Returns: StockMovementRow;
      };
      adjust_variant_stock: {
        Args: {
          p_variant_id: string;
          p_new_quantity: number;
          p_reference_type?: string | null;
          p_reference_id?: string | null;
          p_note?: string | null;
        };
        Returns: StockMovementRow;
      };
      deduct_variant_stock: {
        Args: {
          p_variant_id: string;
          p_quantity: number;
          p_reference_type?: string | null;
          p_reference_id?: string | null;
          p_note?: string | null;
        };
        Returns: StockMovementRow;
      };
      receive_purchase_order: {
        Args: {
          p_purchase_order_id: string;
        };
        Returns: PurchaseOrderRow;
      };
    };
    Enums: {
      product_status: ProductStatus;
      product_variant_status: ProductStatus;
      stock_movement_type: StockMovementType;
      order_source: OrderSource;
      order_status: OrderStatus;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      delivery_status: DeliveryStatus;
      return_type: ReturnType;
      return_reason: ReturnReason;
      return_condition: ReturnCondition;
      return_status: ReturnStatus;
      return_item_action: ReturnItemAction;
      purchase_status: PurchaseStatus;
      purchase_payment_status: PurchasePaymentStatus;
      expense_category: ExpenseCategory;
      staff_role: StaffRole;
      staff_status: StaffStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
