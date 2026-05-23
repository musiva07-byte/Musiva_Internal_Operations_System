# AGENTS.md — Musiva Internal Operations System

## Project Identity

Project name: **Musiva Internal Operations System**

Brand: **Moosiva / Musiva Lux Wear**

Business type: Ladies' boutique and online-first fashion business based in Bahrain.

Purpose: Build a complete private internal system for managing boutique operations including inventory, product variants, stock movements, sales, orders, customer details, deliveries, receipt printing, parcel labels, returns, exchanges, expenses, suppliers, reports, staff roles, and future ecommerce readiness.

This is not an MVP. Build it as a production-ready internal business system from scratch to finish.

The system must be fast, smooth, secure, clean, scalable, and easy for non-technical boutique staff to use.

---

## 1. Final Technology Stack

Use this stack only:

- **Framework:** Next.js App Router
- **Frontend:** React + TypeScript
- **Backend:** Node.js through Next.js Server Actions and API Routes
- **Database:** Supabase PostgreSQL
- **Authentication:** Supabase Auth
- **Authorization:** Role-based permissions + Supabase Row Level Security
- **Storage:** Supabase Storage
- **Hosting:** Vercel
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Forms:** React Hook Form
- **Validation:** Zod
- **Tables:** TanStack Table
- **Charts:** Recharts
- **Icons:** Lucide React
- **Date Handling:** date-fns
- **PDF/Print:** Browser print templates using dedicated print pages
- **Currency:** Bahraini Dinar, BHD
- **Region:** Bahrain

Do not use Laravel.

Do not create a separate backend project.

Do not create an Express server unless absolutely necessary.

Keep the full system inside one Next.js project.

---

## 2. Hosting and Domain Structure

The system should support this domain structure:

```txt
musiva.com              → future ecommerce website
admin.musiva.com        → internal operations system
```

For now, build the internal system. Keep the structure ready so ecommerce can be added later.

Recommended routing:

```txt
/admin                  → protected internal dashboard
/login                  → staff login
/print/invoice/[id]     → printable invoice
/print/label/[id]       → printable delivery label
/print/combined/[id]    → combined A4 invoice + delivery label
```

The project must work on Vercel.

Use environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

---

## 3. Brand Direction

Use the attached Musiva logo as the brand reference.

Brand name shown in logo: **Moosiva Lux Wear**

The interface should feel:

- Feminine
- Premium
- Clean
- Elegant
- Soft
- Modern
- Boutique-style
- Not like a warehouse system
- Not too colorful
- Easy for staff to use

Approximate logo color:

```txt
Primary Brand Pink: #BC408D
Soft Pink: #DEA6CA
Deep Text: #1F1F1F
Warm Background: #FAF7F9
Card Background: #FFFFFF
Border: #E8DCE5
Muted Text: #6F6470
Success: #15803D
Warning: #B7791F
Danger: #B91C1C
```

Use a premium light UI.

Avoid dark admin panels.

Use generous spacing, rounded cards, soft shadows, and clear typography.

Suggested font stack:

```css
font-family: Inter, system-ui, sans-serif;
```

If adding a display heading font, use something elegant and readable, but keep the admin system practical.

---

## 4. Product Goal

Build a complete internal operations system for Musiva before the ecommerce website launch.

The system must allow Musiva staff to:

1. Login securely
2. Manage products
3. Manage product variants by size and color
4. Add stock
5. Track every stock movement
6. Create sales/orders
7. Auto-deduct stock after sales
8. Store customer details
9. Store Bahrain delivery addresses
10. Print A4 invoices
11. Print A4 delivery labels
12. Print combined invoice + label on one A4 page
13. Manage delivery status
14. Manage returns and exchanges
15. Manage suppliers
16. Manage purchases
17. Manage expenses
18. View reports
19. Manage staff users and roles
20. Configure business settings

---

## 5. Core User Roles

Create role-based access.

Roles:

```txt
owner
manager
sales_staff
inventory_staff
accountant
delivery_coordinator
```

Permission logic:

### Owner

Can access everything.

### Manager

Can manage products, inventory, orders, returns, reports, customers, deliveries, suppliers, purchases, and expenses.

Cannot delete system-critical data unless allowed by owner.

### Sales Staff

Can:

- Create orders
- View products
- View stock availability
- Add customers
- Print invoices
- Print delivery labels
- Update order status
- Process simple returns if permission is enabled

Cannot:

- See cost price
- See profit reports
- Manage users
- Delete products
- Change settings

### Inventory Staff

Can:

- Add products
- Add stock
- Adjust stock
- View inventory reports
- View suppliers and purchases

Cannot:

- See profit reports unless allowed
- Manage staff users
- Change business settings

### Accountant

Can:

- View sales reports
- View expense reports
- View profit reports
- Export reports
- View payment status

Cannot:

- Create or edit orders unless allowed
- Adjust stock unless allowed

### Delivery Coordinator

Can:

- View delivery queue
- Update delivery statuses
- Print delivery labels
- View customer delivery details

Cannot:

- See profit
- Edit products
- Adjust stock
- Manage users

---

## 6. Authentication Requirements

Use Supabase Auth.

Required features:

- Email/password login
- Protected admin routes
- Logout
- Session persistence
- Role lookup from `profiles` table
- Redirect unauthenticated users to `/login`
- Redirect authenticated users from `/login` to `/admin/dashboard`
- Block unauthorized pages based on role
- Use middleware for route protection
- Use server-side authorization checks for mutations

Never rely only on frontend hiding.

All important write operations must check permission on the server.

---

## 7. Main Navigation

The admin sidebar should include:

```txt
Dashboard
Products
Inventory
Orders
Customers
Deliveries
Returns & Exchanges
Suppliers
Purchases
Expenses
Reports
Staff & Roles
Settings
```

Use a clean sidebar with Musiva logo at the top.

Mobile layout should be responsive with collapsible sidebar.

---

## 8. Required Pages

Build these pages:

```txt
/login

/admin/dashboard

/admin/products
/admin/products/new
/admin/products/[id]
/admin/products/[id]/edit

/admin/inventory
/admin/inventory/stock-entry
/admin/inventory/adjustments
/admin/inventory/movements

/admin/orders
/admin/orders/new
/admin/orders/[id]
/admin/orders/[id]/edit

/admin/customers
/admin/customers/new
/admin/customers/[id]
/admin/customers/[id]/edit

/admin/deliveries
/admin/deliveries/[id]

/admin/returns
/admin/returns/new
/admin/returns/[id]

/admin/suppliers
/admin/suppliers/new
/admin/suppliers/[id]
/admin/suppliers/[id]/edit

/admin/purchases
/admin/purchases/new
/admin/purchases/[id]

/admin/expenses
/admin/expenses/new
/admin/expenses/[id]

/admin/reports
/admin/reports/sales
/admin/reports/inventory
/admin/reports/customers
/admin/reports/finance

/admin/staff
/admin/staff/new
/admin/staff/[id]

/admin/settings

/print/invoice/[id]
/print/label/[id]
/print/combined/[id]
```

---

## 9. Dashboard Requirements

Dashboard must show:

- Today’s sales
- This month’s sales
- Total orders today
- Pending deliveries
- Low-stock products
- Out-of-stock products
- Recent orders
- Best-selling products
- Sales chart
- Payment status summary
- Delivery status summary

Cards should be clean and visual.

Use BHD formatting:

```txt
12.500 BHD
```

Use three decimal places for Bahraini Dinar.

---

## 10. Product Management

Products must support variants.

Example:

```txt
Product: Satin Dress
Variants:
- Black / S
- Black / M
- Black / L
- Beige / S
- Beige / M
- Beige / L
```

### Product Fields

```txt
id
name
sku
category_id
collection
description
material
care_instructions
status
created_at
updated_at
```

Status values:

```txt
active
inactive
archived
```

### Product Variant Fields

```txt
id
product_id
variant_sku
barcode
color
size
cost_price
selling_price
discount_price
stock_quantity
minimum_stock
status
created_at
updated_at
```

Each variant must have separate stock.

Do not store only one quantity at product level.

---

## 11. Product Images

Use Supabase Storage for product images.

Requirements:

- Upload multiple images per product
- Set one primary image
- Compress images before upload if possible
- Show image thumbnails in product table
- Store image metadata in `product_images`

Fields:

```txt
id
product_id
variant_id nullable
url
path
is_primary
sort_order
created_at
```

---

## 12. Inventory Management

Inventory must be transaction-safe.

Every stock change must create a stock movement record.

Never silently update stock.

### Stock Movement Types

```txt
opening_stock
purchase_stock
sale_deduction
return_added
exchange_deduction
damaged
manual_adjustment
cancelled_order_restore
```

### Stock Movement Fields

```txt
id
product_variant_id
movement_type
quantity
previous_quantity
new_quantity
reference_type
reference_id
note
created_by
created_at
```

### Inventory Rules

When stock is added:

1. Validate staff permission
2. Get current stock
3. Add quantity
4. Update product variant stock
5. Create stock movement

When sale is created:

1. Check available stock
2. Deduct quantity
3. Create stock movement
4. Save order item snapshot

When order is cancelled before delivery:

1. Restore stock
2. Create `cancelled_order_restore` movement

When return is accepted:

1. If sellable, add back to stock
2. If damaged, do not add to sellable stock
3. Create stock movement

---

## 13. Orders and Sales

Orders must support both online and physical boutique sales.

Order sources:

```txt
instagram
whatsapp
website
walk_in
tiktok
referral
other
```

Order statuses:

```txt
new
confirmed
packed
ready_for_pickup
out_for_delivery
delivered
cancelled
returned
exchange_requested
```

Payment methods for Bahrain:

```txt
cash
benefitpay
card
bank_transfer
payment_link
cash_on_delivery
```

Payment statuses:

```txt
unpaid
paid
partial
cod
refunded
```

### Order Fields

```txt
id
order_number
customer_id
order_source
order_status
payment_status
payment_method
subtotal
discount_total
delivery_charge
grand_total
amount_paid
amount_due
staff_id
notes
created_at
updated_at
```

### Order Item Fields

```txt
id
order_id
product_variant_id
product_name_snapshot
variant_sku_snapshot
size_snapshot
color_snapshot
quantity
unit_price
discount
line_total
created_at
```

Always store snapshots of product name, size, color, and price so old invoices remain accurate even if product data changes later.

---

## 14. Order Creation Workflow

Create a service function:

```ts
createOrder(input)
```

It must:

1. Validate authenticated user
2. Validate permission
3. Validate customer information
4. Validate selected products
5. Check stock availability
6. Create or update customer
7. Generate order number
8. Create order
9. Create order items
10. Deduct stock
11. Create stock movement records
12. Create delivery record if delivery is required
13. Create payment record if needed
14. Create audit log
15. Return created order

Order number format:

```txt
MSV-10001
MSV-10002
MSV-10003
```

Do not use random order numbers.

Use a safe sequence strategy.

---

## 15. Customer Management

Customer fields:

```txt
id
full_name
mobile
whatsapp
email
area
governorate
block
road
building
flat
landmark
delivery_notes
created_at
updated_at
```

Bahrain address fields must support:

```txt
Governorate
Area
Block
Road
Building
Flat / Apartment
Landmark
Delivery Notes
```

Customer profile should show:

- Contact details
- Address details
- Total orders
- Total spending
- Last order date
- Order history

Mobile number should be searchable.

---

## 16. Delivery Management

Delivery fields:

```txt
id
order_id
customer_name
phone
governorate
area
block
road
building
flat
landmark
delivery_note
delivery_date
delivery_time_slot
courier_name
courier_phone
delivery_status
created_at
updated_at
```

Delivery statuses:

```txt
pending
packed
ready_for_pickup
with_courier
out_for_delivery
delivered
failed
returned
```

Delivery page must allow:

- Filter by status
- Filter by date
- Search by order number
- Search by customer phone
- Print delivery label
- Update delivery status

---

## 17. Invoice Printing

Create:

```txt
/print/invoice/[id]
```

Invoice must be A4 print-friendly.

Invoice must include:

- Musiva logo
- Brand name
- Order number
- Date/time
- Staff name
- Customer name
- Customer mobile
- Items table
- Quantity
- Unit price
- Discount
- Delivery charge
- Grand total
- Payment method
- Payment status
- Amount paid
- Amount due
- Return/exchange note
- WhatsApp number
- Instagram handle

Use clean boutique design.

Use brand pink as accent.

Make it readable in black and white also.

Add print button on screen, but hide button while printing using print CSS.

---

## 18. Delivery Label Printing

Create:

```txt
/print/label/[id]
```

Label must look like a shipping/cargo parcel cover label.

Large readable format.

Include:

```txt
MUSIVA DELIVERY LABEL
Order Number
Date
Customer Name
Mobile
Governorate
Area
Block
Road
Building
Flat
Landmark
Items Summary
Payment Status
COD Amount / Amount to Collect
Delivery Notes
```

Important:

- Make customer phone and address large and readable
- Use strong borders
- Use A4-compatible layout
- Staff should be able to print and paste on delivery bag

---

## 19. Combined A4 Print

Create:

```txt
/print/combined/[id]
```

Layout:

```txt
Top 50%: Delivery Label
Bottom 50%: Customer Invoice
```

This is the preferred print format for daily operations.

Add print CSS:

```css
@media print {
  body {
    margin: 0;
  }

  .no-print {
    display: none;
  }

  .print-page {
    width: 210mm;
    min-height: 297mm;
  }
}
```

---

## 20. Returns and Exchanges

Returns and exchanges are required.

Return reasons:

```txt
size_issue
color_issue
damaged_item
wrong_item_sent
customer_changed_mind
delivery_failed
other
```

Return condition:

```txt
sellable
damaged
needs_review
```

Return fields:

```txt
id
original_order_id
customer_id
return_type
reason
condition
refund_amount
exchange_order_id nullable
status
staff_id
notes
created_at
updated_at
```

Return item fields:

```txt
id
return_id
product_variant_id
quantity
action
created_at
```

Return actions:

```txt
add_back_to_stock
mark_damaged
exchange
refund_only
no_stock_change
```

Rules:

- If item is sellable, add back to stock.
- If damaged, do not add to available stock.
- If exchange, add old item back if sellable and deduct new item.
- Create stock movements for every stock change.
- Create audit log.

---

## 21. Suppliers

Supplier fields:

```txt
id
supplier_name
contact_person
phone
email
country
address
notes
created_at
updated_at
```

Supplier profile should show:

- Supplier details
- Purchase history
- Total purchase value
- Last purchase date

---

## 22. Purchase Management

Purchase orders are required for stock entry.

Purchase order fields:

```txt
id
purchase_number
supplier_id
purchase_date
expected_arrival_date
actual_arrival_date
status
payment_status
subtotal
discount
shipping_cost
grand_total
notes
created_by
created_at
updated_at
```

Purchase statuses:

```txt
draft
ordered
partially_received
received
cancelled
```

Payment statuses:

```txt
unpaid
partial
paid
```

Purchase order item fields:

```txt
id
purchase_order_id
product_variant_id
quantity_ordered
quantity_received
cost_price
line_total
created_at
```

When purchase is marked received:

1. Increase stock
2. Create stock movements
3. Update purchase status
4. Create audit log

---

## 23. Expenses

Expense fields:

```txt
id
category
amount
expense_date
payment_method
vendor
notes
attachment_url
created_by
created_at
updated_at
```

Expense categories:

```txt
product_purchase
packaging
delivery
marketing
rent
staff_salary
utilities
software
miscellaneous
```

Expenses should appear in finance reports.

---

## 24. Reports

Reports are required.

### Sales Reports

Include:

- Daily sales
- Weekly sales
- Monthly sales
- Sales by product
- Sales by category
- Sales by staff
- Sales by order source
- Sales by payment method
- Sales by payment status

### Inventory Reports

Include:

- Current stock
- Low stock
- Out of stock
- Fast-moving products
- Slow-moving products
- Damaged stock
- Stock movement history

### Customer Reports

Include:

- Top customers
- Repeat customers
- New customers
- Customer purchase history

### Finance Reports

Include:

- Revenue
- Discounts
- Delivery charges
- Cost of goods sold
- Gross profit
- Expenses
- Estimated net profit

Use date filters:

```txt
Today
Yesterday
This Week
This Month
Last Month
Custom Range
```

Allow CSV export for reports.

---

## 25. Settings

Settings page should allow owner/manager to update:

```txt
Business name
Logo
WhatsApp number
Instagram handle
Business address
Invoice footer
Return policy text
Default delivery charge
Currency
Low stock default quantity
Receipt theme
```

Currency must default to:

```txt
BHD
```

---

## 26. Database Tables

Create Supabase SQL migrations for these tables:

```txt
profiles
roles
permissions
categories
products
product_variants
product_images
stock_movements
customers
orders
order_items
payments
deliveries
returns
return_items
suppliers
purchase_orders
purchase_order_items
expenses
settings
audit_logs
```

Use UUID primary keys unless a sequence is needed for order numbers.

Use `created_at` and `updated_at` on all business tables.

Use foreign keys.

Use indexes on frequently searched fields.

Required indexes:

```sql
create index idx_orders_order_number on orders(order_number);
create index idx_orders_created_at on orders(created_at);
create index idx_orders_order_status on orders(order_status);
create index idx_orders_payment_status on orders(payment_status);
create index idx_customers_mobile on customers(mobile);
create index idx_product_variants_sku on product_variants(variant_sku);
create index idx_product_variants_barcode on product_variants(barcode);
create index idx_stock_movements_variant on stock_movements(product_variant_id);
create index idx_stock_movements_created_at on stock_movements(created_at);
create index idx_deliveries_status on deliveries(delivery_status);
create index idx_deliveries_date on deliveries(delivery_date);
```

---

## 27. Supabase Row Level Security

Enable RLS on all tables.

Use policies so authenticated users can only access data according to role.

Important:

- Anonymous users must not access admin data.
- Staff must not access cost price if not permitted.
- Only owner can manage users and settings.
- Only permitted roles can create stock adjustments.
- Only permitted roles can view financial reports.

Use server-side functions for sensitive operations.

Do not expose service role key to client components.

---

## 28. Code Organization

Use this structure:

```txt
app/
  login/
  admin/
  print/
  api/

components/
  ui/
  layout/
  forms/
  tables/
  dashboard/
  products/
  orders/
  inventory/
  customers/
  print/

lib/
  supabase/
  auth/
  permissions/
  services/
  validations/
  formatters/
  constants/
  utils/

database/
  migrations/
  seed/

types/
  database.ts
  app.ts
```

Service files:

```txt
lib/services/product.service.ts
lib/services/inventory.service.ts
lib/services/order.service.ts
lib/services/customer.service.ts
lib/services/delivery.service.ts
lib/services/return.service.ts
lib/services/purchase.service.ts
lib/services/expense.service.ts
lib/services/report.service.ts
lib/services/audit.service.ts
```

Validation files:

```txt
lib/validations/product.schema.ts
lib/validations/order.schema.ts
lib/validations/customer.schema.ts
lib/validations/return.schema.ts
lib/validations/purchase.schema.ts
lib/validations/expense.schema.ts
```

Constants:

```txt
lib/constants/roles.ts
lib/constants/statuses.ts
lib/constants/payment-methods.ts
lib/constants/bahrain.ts
```

---

## 29. UI Requirements

Use shadcn/ui components.

Use:

- Cards
- Tables
- Dialogs
- Dropdown menus
- Date pickers
- Form inputs
- Select fields
- Badges
- Tabs
- Toast notifications
- Confirmation dialogs

All destructive actions require confirmation.

Use status badges:

```txt
Paid → green
Unpaid → red
COD → amber
Delivered → green
Pending → amber
Cancelled → red
Low Stock → amber
Out of Stock → red
```

Do not overload pages.

Use filters and search.

Use pagination for large tables.

---

## 30. Performance Requirements

The system must feel fast and smooth.

Implement:

- Server components for initial data loading
- Client components only for interactive UI
- Pagination for products, orders, customers, and stock movements
- Debounced search
- Database indexes
- Optimized Supabase queries
- Avoid loading all rows at once
- Image thumbnails instead of full images in tables
- Lazy-load heavy charts
- Use skeleton loaders
- Use toast feedback after actions
- Use optimistic UI only when safe

Never fetch huge datasets into the browser.

Reports must use filtered queries or database views.

---

## 31. Security Requirements

Security is critical because the system stores:

- Customer names
- Phone numbers
- Addresses
- Sales data
- Stock data
- Payment status

Implement:

- Auth-protected routes
- Role checks
- Server-side validation
- Zod validation
- Supabase RLS
- No secret keys in client code
- Audit logs for important actions
- Safe error handling
- No detailed database errors shown to users
- Input sanitization
- Proper file upload validation
- Secure environment variables

Audit these actions:

```txt
login
create_order
update_order
cancel_order
create_product
update_product
delete_product
add_stock
adjust_stock
process_return
create_purchase
receive_purchase
create_expense
update_settings
manage_user
```

---

## 32. Error Handling

Use user-friendly error messages.

Examples:

```txt
Not enough stock available.
You do not have permission to perform this action.
Customer phone number is required.
Please select at least one product.
Order could not be created. Please try again.
```

Do not show raw database errors.

Log technical errors internally.

---

## 33. Formatting Rules

Currency:

```txt
BHD 12.500
```

Dates:

```txt
23 May 2026
```

Date and time:

```txt
23 May 2026, 4:30 PM
```

Phone numbers:

Support Bahrain format:

```txt
+973 XXXX XXXX
```

Order numbers:

```txt
MSV-10001
```

Purchase numbers:

```txt
PO-10001
```

---

## 34. Bahrain-Specific Requirements

Use Bahrain context.

Governorate options:

```txt
Capital Governorate
Muharraq Governorate
Northern Governorate
Southern Governorate
```

Payment methods must include:

```txt
BenefitPay
Cash
Card
Bank Transfer
Payment Link
Cash on Delivery
```

Currency:

```txt
BHD
```

Address fields must include:

```txt
Area
Block
Road
Building
Flat
Landmark
```

---

## 35. Future Ecommerce Readiness

Do not build ecommerce now, but design database so ecommerce can connect later.

Future ecommerce needs:

- Products
- Product variants
- Product images
- Stock availability
- Customer orders
- Online payment
- Delivery tracking

Therefore:

- Keep products clean
- Keep product status
- Keep variant stock accurate
- Keep images in Supabase Storage
- Keep order source as `website`
- Keep customer records reusable

Do not hardcode admin-only assumptions into product database.

---

## 36. Development Phases

Build in this order.

### Phase 1 — Foundation

- Next.js setup
- Tailwind setup
- shadcn/ui setup
- Supabase setup
- Auth setup
- Protected routes
- Admin layout
- Sidebar
- Theme colors
- Settings table
- Profiles and roles

### Phase 2 — Products and Inventory

- Categories
- Products
- Variants
- Images
- Stock entry
- Stock movements
- Low stock alerts

### Phase 3 — Customers and Orders

- Customers
- Create order
- Order items
- Stock deduction
- Payment status
- Order status
- Order details page

### Phase 4 — Printing

- Invoice print page
- Delivery label print page
- Combined A4 print page
- Print CSS
- Musiva branding

### Phase 5 — Delivery

- Delivery records
- Delivery status
- Delivery filters
- Delivery label actions

### Phase 6 — Returns and Exchanges

- Return creation
- Exchange handling
- Stock restoration
- Refund tracking

### Phase 7 — Suppliers and Purchases

- Supplier management
- Purchase orders
- Receive stock
- Purchase payment status

### Phase 8 — Expenses and Reports

- Expense management
- Sales reports
- Inventory reports
- Customer reports
- Finance reports
- CSV exports

### Phase 9 — Staff and Settings

- Staff management
- Role management
- Business settings
- Logo upload
- Receipt settings

### Phase 10 — Production Polish

- Loading states
- Empty states
- Error states
- Audit logs
- Security review
- Performance review
- Vercel deployment
- Supabase policies review

---

## 37. Acceptance Criteria

The system is complete only when:

- Staff can login
- Owner can manage users
- Products can be created with variants
- Stock can be added
- Every stock change is logged
- Orders can be created
- Stock deducts automatically
- Orders can be searched and filtered
- Customers are saved
- Bahrain delivery details are saved
- Invoice can print on A4
- Delivery label can print on A4
- Combined invoice + label can print on A4
- Returns can be processed
- Exchanges can be processed
- Suppliers can be added
- Purchases can increase stock
- Expenses can be recorded
- Reports show correct data
- Permissions work
- RLS is enabled
- UI is responsive
- App is deployed on Vercel
- No secret keys are exposed
- System feels fast and smooth

---

## 38. Important Implementation Rules

Always use TypeScript.

Always validate form input with Zod.

Always check permission before write operations.

Always create stock movement records.

Always use order item snapshots.

Always use BHD currency formatting.

Always use pagination on large tables.

Always protect admin routes.

Always use Supabase server client for secure operations.

Never expose service role key to frontend.

Never update stock from client-side only.

Never delete financial or stock records permanently. Use archive/status where possible.

Never build a full billing POS. This is an internal boutique operations system with A4 invoice and delivery label printing.

---

## 39. Suggested Seed Data

Create initial seed data:

### Categories

```txt
Dresses
Abayas
Tops
Bottoms
Bags
Accessories
Luxury Wear
New Collection
```

### Payment Methods

```txt
Cash
BenefitPay
Card
Bank Transfer
Payment Link
Cash on Delivery
```

### Order Sources

```txt
Instagram
WhatsApp
Website
Walk-in
TikTok
Referral
Other
```

### Default Settings

```txt
Business Name: Moosiva Lux Wear
Currency: BHD
Default Delivery Charge: 0.000
Invoice Footer: Thank you for shopping with Moosiva Lux Wear.
Return Policy: Exchange is subject to boutique policy and item condition.
```

---

## 40. Final Build Instruction

Build the system as a production-ready internal operations platform for a Bahrain-based ladies' boutique.

Prioritize:

1. Correct business logic
2. Stock accuracy
3. Smooth user experience
4. Clean premium design
5. Security
6. Fast performance
7. Future ecommerce readiness

Use the Musiva logo and pink brand color throughout the admin interface and print templates.

The final result should feel like a premium boutique control panel, not a generic inventory app.
