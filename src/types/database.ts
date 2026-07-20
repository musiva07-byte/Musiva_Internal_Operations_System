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

export type ProductStatus = "draft" | "active" | "inactive" | "archived";
export type StockMovementType =
  | "opening_stock"
  | "purchase_stock"
  | "sale_deduction"
  | "return_added"
  | "exchange_deduction"
  | "damaged"
  | "manual_adjustment"
  | "cancelled_order_restore";
export type OrderSource =
  | "instagram"
  | "whatsapp"
  | "website"
  | "walk_in"
  | "tiktok"
  | "referral"
  | "other"
  | "website_request";
export type OrderStatus =
  // Current simplified statuses
  | "new"
  | "confirmed"
  | "in_fulfilment"
  | "completed"
  | "cancelled"
  | "returned"
  | "exchange_requested"
  // Legacy statuses — kept so existing DB rows remain valid; not exposed in new UI
  | "packed"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered";
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
  | "returned_to_store"
  | "cancelled"
  | "returned";  // legacy — kept for existing rows
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
export type PurchaseStatus =
  | "draft"
  | "ordered"
  | "in_transit"
  | "partially_received"
  | "received"
  | "cancelled";
export type PurchasePaymentStatus = "unpaid" | "partial" | "paid";
export type WebsiteOrderRequestStatus = "new" | "contacted" | "confirmed" | "cancelled";
export type WebsiteRequestPaymentPreference =
  | "cash_on_delivery"
  | "benefitpay"
  | "bank_transfer"
  | "payment_link";
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
export type PricingStatus = "regular" | "discount_scheduled" | "on_sale" | "discount_ended";
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
export type FulfilmentMethod = "walk_in" | "customer_pickup" | "delivery";

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
  // Ecommerce publishing fields (Phase: website readiness)
  slug: string | null;
  website_visible: boolean;
  online_status: ProductOnlineStatus;
  website_title: string | null;
  website_description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  featured: boolean;
  new_arrival: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** Public website visibility only becomes 'published' when staff opts the product in. */
export type ProductOnlineStatus = "draft" | "published" | "hidden";

// ── Public-safe views (read-only; anon-readable — see
// database/migrations/202607150001_ecommerce_publishing.sql) ────────────────

export type PublicProductRow = {
  id: string;
  name: string;
  slug: string;
  category_id: string | null;
  collection: string | null;
  description: string | null;
  material: string | null;
  care_instructions: string | null;
  website_title: string | null;
  website_description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  featured: boolean;
  new_arrival: boolean;
  sort_order: number;
};

export type PublicProductVariantRow = {
  id: string;
  product_id: string;
  color: string;
  size: string;
  regular_selling_price_bhd: number | null;
  discount_price_bhd: number | null;
  discount_start_at: string | null;
  discount_end_at: string | null;
  stock_quantity: number;
};

export type PublicProductImageRow = {
  id: string;
  product_id: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
};

export type PublicCategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
};

export type PublicSiteSettingsRow = {
  business_name: string;
  logo_url: string | null;
  whatsapp_number: string | null;
  instagram_handle: string | null;
};

export type ProductVariantRow = {
  id: string;
  product_id: string;
  variant_sku: string;
  barcode: string | null;
  color: string;
  size: string;
  /** @deprecated Use regular_selling_price_bhd */
  cost_price: number;
  /** @deprecated Use regular_selling_price_bhd */
  selling_price: number;
  /** @deprecated Use discount_price_bhd */
  discount_price: number | null;
  // New pricing fields (Phase 11)
  regular_selling_price_bhd: number | null;
  discount_price_bhd: number | null;
  discount_start_at: string | null;
  discount_end_at: string | null;
  latest_landed_cost_bhd: number | null;
  average_landed_cost_bhd: number | null;
  /** Buying price in INR that produced latest_landed_cost_bhd (multiply-direction rate). */
  latest_supplier_unit_cost_inr: number | null;
  /** 1 INR expressed in BHD, as used for latest_landed_cost_bhd. */
  latest_exchange_rate_to_bhd: number | null;
  /** Optional advanced field (cargo/customs/packaging/etc per piece). Never null — 0 means
   *  "not entered". Never trusted on its own; only meaningful alongside a valid INR + rate. */
  latest_additional_landed_cost_bhd: number;
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
  mobile_normalized: string | null;
  whatsapp: string | null;
  whatsapp_normalized: string | null;
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

export type CustomerAddressRow = {
  id: string;
  customer_id: string;
  label: string;
  governorate: string | null;
  area: string | null;
  block: string | null;
  road: string | null;
  building: string | null;
  flat: string | null;
  landmark: string | null;
  delivery_notes: string | null;
  is_default: boolean;
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
  fulfilment_method: FulfilmentMethod;
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
  assigned_to_id: string | null;
  assigned_at: string | null;
  failure_reason: string | null;
  failure_note: string | null;
  cod_amount: number | null;
  cod_collected: boolean;
  cod_collected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DeliveryStatusHistoryRow = {
  id: string;
  delivery_id: string;
  from_status: DeliveryStatus | null;
  to_status: DeliveryStatus;
  reason: string | null;
  note: string | null;
  changed_by: string | null;
  created_at: string;
};

export type DeliveryChargeRuleRow = {
  id: string;
  governorate: string | null;
  area: string | null;
  charge_bhd: number;
  is_default: boolean;
  notes: string | null;
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

/**
 * Created by the public ecommerce website (www.moosivabh.com), NOT this project —
 * see moosiva-website/database/migrations/202607171000_create_website_order_requests.sql
 * for the authoritative table definition. This is a pending customer request, never a
 * final order: no stock is deducted, no order/order_items row exists for it.
 *
 * RLS: enabled with zero policies for INSERT/DELETE (only the website's service-role key
 * may create rows). This project's own migration
 * (database/migrations/202607171100_website_order_requests_staff_access.sql) adds
 * `to authenticated` SELECT/UPDATE policies so staff can view and update status here.
 */
export type WebsiteOrderRequestRow = {
  id: string;
  request_number: string;
  product_id: string;
  product_variant_id: string;
  product_name_snapshot: string;
  color_snapshot: string | null;
  size_snapshot: string | null;
  quantity: number;
  unit_price_snapshot: number;
  total_snapshot: number;
  customer_name: string;
  mobile_display: string;
  mobile_normalized: string;
  whatsapp_display: string;
  whatsapp_normalized: string;
  governorate: string;
  area: string;
  block: string | null;
  road: string | null;
  building: string | null;
  flat: string | null;
  landmark: string | null;
  delivery_notes: string | null;
  payment_preference: WebsiteRequestPaymentPreference;
  status: WebsiteOrderRequestStatus;
  whatsapp_message: string;
  /** Set together, atomically, only by convertWebsiteRequestToOrder(). converted_order_id
   *  is the idempotency guard — once set, this request can never be converted again. */
  converted_order_id: string | null;
  converted_at: string | null;
  converted_by: string | null;
  created_at: string;
  updated_at: string;
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
  /** BHD shipping cost — same field as shipping_cost_bhd in application layer */
  shipping_cost: number;
  grand_total: number;
  // Phase 11 fields
  purchase_currency: string;
  exchange_rate_to_bhd: number | null;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
  customs_cost_bhd: number;
  bank_fee_bhd: number;
  packaging_cost_bhd: number;
  other_import_cost_bhd: number;
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
  /** @deprecated Use landed_unit_cost_bhd */
  cost_price: number;
  /** @deprecated Use landed_unit_cost_bhd * quantity_ordered */
  line_total: number;
  // Phase 11 fields
  supplier_unit_cost: number | null;
  supplier_currency: string | null;
  converted_unit_cost_bhd: number | null;
  allocated_import_cost_bhd: number;
  landed_unit_cost_bhd: number | null;
  created_at: string;
};

/** rate = 1 unit of quote_currency expressed in BHD (multiply direction) for rows managed
 *  through Settings → Exchange Rates. See 202607171400_exchange_rate_settings.sql. */
export type ExchangeRateRow = {
  id: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  rate_date: string;
  source: string;
  is_manual: boolean;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryBatchRow = {
  id: string;
  /** Null for opening-stock batches created during product creation (no purchase order). */
  purchase_order_item_id: string | null;
  product_variant_id: string;
  quantity_received: number;
  quantity_remaining: number;
  supplier_unit_cost: number | null;
  supplier_currency: string | null;
  /** Stored as the UI multiply-direction rate (BHD per supplier unit) for opening-stock
   *  batches, and as the purchase-module divide-direction (INR per BHD) for purchase batches.
   *  Use landed_unit_cost_bhd for cost calculations — do not interpret this field without
   *  checking batch_type. */
  exchange_rate_to_bhd: number | null;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
  converted_unit_cost_bhd: number | null;
  allocated_import_cost_bhd: number;
  landed_unit_cost_bhd: number | null;
  /** "purchase" (linked to a purchase order item) or "opening_stock" (new product creation). */
  batch_type: string;
  received_at: string;
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
      customer_addresses: TableDefinition<CustomerAddressRow, Insertable<CustomerAddressRow>>;
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
      delivery_status_history: TableDefinition<DeliveryStatusHistoryRow, InsertableCreated<DeliveryStatusHistoryRow>>;
      delivery_charge_rules: TableDefinition<DeliveryChargeRuleRow, Insertable<DeliveryChargeRuleRow>>;
      audit_logs: TableDefinition<AuditLogRow, InsertableCreated<AuditLogRow>>;
      // Insert type included for completeness only — this project never inserts rows here,
      // it only reads/updates status. See WebsiteOrderRequestRow's doc comment above.
      website_order_requests: TableDefinition<WebsiteOrderRequestRow, Insertable<WebsiteOrderRequestRow>>;
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
      exchange_rates: TableDefinition<ExchangeRateRow, InsertableCreated<ExchangeRateRow>>;
      inventory_batches: TableDefinition<InventoryBatchRow, InsertableCreated<InventoryBatchRow>>;
      expenses: TableDefinition<ExpenseRow, Insertable<ExpenseRow>>;
      roles: TableDefinition<RoleRow, Insertable<RoleRow>>;
      permissions: TableDefinition<PermissionRow, InsertableCreated<PermissionRow>>;
      role_permissions: TableDefinition<RolePermissionRow, RolePermissionRow>;
      profiles: TableDefinition<ProfileRow, ProfileRow>;
      settings: TableDefinition<SettingsRow, Insertable<SettingsRow>>;
    };
    Views: {
      public_products: TableDefinition<PublicProductRow>;
      public_product_variants: TableDefinition<PublicProductVariantRow>;
      public_product_images: TableDefinition<PublicProductImageRow>;
      public_categories: TableDefinition<PublicCategoryRow>;
      public_site_settings: TableDefinition<PublicSiteSettingsRow>;
    };
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
      set_exchange_rate: {
        Args: {
          p_quote_currency: string;
          p_rate: number;
          p_effective_date: string;
          p_source?: string;
        };
        Returns: ExchangeRateRow;
      };
      recalculate_average_landed_cost: {
        Args: {
          p_variant_id: string;
        };
        Returns: number | null;
      };
      advance_delivery_status: {
        Args: {
          p_delivery_id: string;
          p_new_status: DeliveryStatus;
          p_reason?: string | null;
          p_note?: string | null;
          p_collected_amt?: number | null;
        };
        Returns: DeliveryRow;
      };
      find_or_create_customer: {
        Args: {
          p_full_name: string;
          p_mobile: string;
          p_whatsapp?: string | null;
          p_email?: string | null;
        };
        Returns: CustomerRow;
      };
      normalize_bahrain_phone: {
        Args: { input: string };
        Returns: string | null;
      };
    };
    Enums: {
      product_status: ProductStatus;
      product_variant_status: ProductStatus;
      product_online_status: ProductOnlineStatus;
      pricing_status: PricingStatus;
      stock_status: StockStatus;
      stock_movement_type: StockMovementType;
      order_source: OrderSource;
      order_status: OrderStatus;         // includes legacy: packed, ready_for_pickup, out_for_delivery, delivered
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      delivery_status: DeliveryStatus;   // includes legacy: returned
      fulfilment_method: FulfilmentMethod;
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
