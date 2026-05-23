-- Demo data for client walkthroughs and local testing.
-- Run after all migrations. This script is idempotent and keeps generated
-- order/purchase sequences ahead of the demo numbers.

insert into categories (name, slug, sort_order)
values
  ('Dresses', 'dresses', 10),
  ('Abayas', 'abayas', 20),
  ('Tops', 'tops', 30),
  ('Bottoms', 'bottoms', 40),
  ('Bags', 'bags', 50),
  ('Accessories', 'accessories', 60),
  ('Luxury Wear', 'luxury-wear', 70),
  ('New Collection', 'new-collection', 80)
on conflict (slug) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order;

insert into settings (
  business_name,
  whatsapp_number,
  instagram_handle,
  business_address,
  invoice_footer,
  return_policy_text,
  default_delivery_charge,
  currency,
  low_stock_default_quantity,
  receipt_theme
)
values (
  'Moosiva Lux Wear',
  '+973 3999 0000',
  '@moosiva_luxwear',
  'Bahrain',
  'Thank you for shopping with Moosiva Lux Wear.',
  'Exchange is subject to boutique policy and item condition.',
  1.500,
  'BHD',
  3,
  'premium_light'
)
on conflict ((true)) do update
set
  business_name = excluded.business_name,
  whatsapp_number = excluded.whatsapp_number,
  instagram_handle = excluded.instagram_handle,
  business_address = excluded.business_address,
  invoice_footer = excluded.invoice_footer,
  return_policy_text = excluded.return_policy_text,
  default_delivery_charge = excluded.default_delivery_charge,
  currency = excluded.currency,
  low_stock_default_quantity = excluded.low_stock_default_quantity,
  receipt_theme = excluded.receipt_theme;

insert into products (
  id,
  name,
  sku,
  category_id,
  collection,
  description,
  material,
  care_instructions,
  status
)
values
  (
    '00000000-0000-4000-8000-000000000101',
    'Satin Wrap Dress',
    'MSV-DRS-SATIN',
    (select id from categories where slug = 'dresses'),
    'Ramadan Edit',
    'Soft satin wrap dress with a feminine drape for boutique occasions.',
    'Satin polyester blend',
    'Hand wash cold. Steam inside out.',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    'Pearl Trim Abaya',
    'MSV-ABY-PEARL',
    (select id from categories where slug = 'abayas'),
    'Luxury Wear',
    'Elegant abaya with pearl-trim sleeves and a clean premium silhouette.',
    'Nida fabric with pearl detailing',
    'Dry clean recommended.',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    'Soft Rib Boutique Top',
    'MSV-TOP-RIB',
    (select id from categories where slug = 'tops'),
    'Everyday Luxe',
    'Comfortable rib top designed for easy styling with skirts or trousers.',
    'Ribbed cotton blend',
    'Machine wash gentle.',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000104',
    'Mini Pearl Clutch',
    'MSV-BAG-CLUTCH',
    (select id from categories where slug = 'bags'),
    'Accessories',
    'Compact evening clutch with pearl-inspired finish.',
    'Faux leather and pearl hardware',
    'Wipe clean with soft cloth.',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000105',
    'Gold Drop Earrings',
    'MSV-ACC-EARRING',
    (select id from categories where slug = 'accessories'),
    'Accessories',
    'Lightweight gold-tone earrings for occasion wear.',
    'Gold-tone alloy',
    'Keep away from perfume and water.',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000106',
    'Tailored Wide Trousers',
    'MSV-BTM-WIDE',
    (select id from categories where slug = 'bottoms'),
    'Everyday Luxe',
    'Wide-leg tailored trousers with a polished boutique fit.',
    'Crepe blend',
    'Machine wash gentle.',
    'active'
  )
on conflict (sku) do update
set
  name = excluded.name,
  category_id = excluded.category_id,
  collection = excluded.collection,
  description = excluded.description,
  material = excluded.material,
  care_instructions = excluded.care_instructions,
  status = excluded.status;

insert into product_variants (
  id,
  product_id,
  variant_sku,
  barcode,
  color,
  size,
  cost_price,
  selling_price,
  discount_price,
  stock_quantity,
  minimum_stock,
  status
)
values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', 'MSV-DRS-SATIN-BLK-S', '973100001', 'Black', 'S', 14.000, 32.500, null, 11, 3, 'active'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000101', 'MSV-DRS-SATIN-BLK-M', '973100002', 'Black', 'M', 14.000, 32.500, null, 8, 3, 'active'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000101', 'MSV-DRS-SATIN-CHM-S', '973100003', 'Champagne', 'S', 14.000, 34.000, 29.500, 5, 4, 'active'),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000102', 'MSV-ABY-PEARL-ROS-S', '973100004', 'Rose', 'S', 22.000, 45.000, null, 4, 3, 'active'),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000102', 'MSV-ABY-PEARL-ROS-M', '973100005', 'Rose', 'M', 22.000, 45.000, null, 0, 3, 'active'),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000103', 'MSV-TOP-RIB-IVY-M', '973100006', 'Ivory', 'M', 7.000, 18.000, null, 16, 4, 'active'),
  ('00000000-0000-4000-8000-000000000207', '00000000-0000-4000-8000-000000000103', 'MSV-TOP-RIB-BLS-S', '973100007', 'Blush', 'S', 7.000, 18.000, null, 2, 4, 'active'),
  ('00000000-0000-4000-8000-000000000208', '00000000-0000-4000-8000-000000000104', 'MSV-BAG-CLUTCH-PNK-OS', '973100008', 'Pink', 'One Size', 6.000, 14.000, null, 7, 2, 'active'),
  ('00000000-0000-4000-8000-000000000209', '00000000-0000-4000-8000-000000000105', 'MSV-ACC-EARRING-GLD-OS', '973100009', 'Gold', 'One Size', 2.500, 8.500, null, 18, 5, 'active'),
  ('00000000-0000-4000-8000-000000000210', '00000000-0000-4000-8000-000000000106', 'MSV-BTM-WIDE-BLK-M', '973100010', 'Black', 'M', 12.000, 27.500, null, 6, 3, 'active')
on conflict (variant_sku) do update
set
  barcode = excluded.barcode,
  color = excluded.color,
  size = excluded.size,
  cost_price = excluded.cost_price,
  selling_price = excluded.selling_price,
  discount_price = excluded.discount_price,
  stock_quantity = excluded.stock_quantity,
  minimum_stock = excluded.minimum_stock,
  status = excluded.status;

insert into product_images (id, product_id, variant_id, url, path, is_primary, sort_order)
values
  ('00000000-0000-4000-8000-000000000251', '00000000-0000-4000-8000-000000000101', null, 'https://images.unsplash.com/photo-1595777457583-95e059d581b8', 'demo/satin-wrap-dress.jpg', true, 1),
  ('00000000-0000-4000-8000-000000000252', '00000000-0000-4000-8000-000000000102', null, 'https://images.unsplash.com/photo-1610030469983-98e550d6193c', 'demo/pearl-trim-abaya.jpg', true, 1),
  ('00000000-0000-4000-8000-000000000253', '00000000-0000-4000-8000-000000000103', null, 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105', 'demo/soft-rib-top.jpg', true, 1),
  ('00000000-0000-4000-8000-000000000254', '00000000-0000-4000-8000-000000000104', null, 'https://images.unsplash.com/photo-1584917865442-de89df76afd3', 'demo/mini-pearl-clutch.jpg', true, 1)
on conflict (id) do update
set
  url = excluded.url,
  path = excluded.path,
  is_primary = excluded.is_primary,
  sort_order = excluded.sort_order;

insert into customers (
  id,
  full_name,
  mobile,
  whatsapp,
  email,
  area,
  governorate,
  block,
  road,
  building,
  flat,
  landmark,
  delivery_notes
)
values
  ('00000000-0000-4000-8000-000000000301', 'Sara Al Khalifa', '+973 3333 1101', '+973 3333 1101', 'sara@example.com', 'Juffair', 'Capital Governorate', '324', '2417', '88', '12', 'Near Al Fateh Grand Mosque', 'Call before delivery.'),
  ('00000000-0000-4000-8000-000000000302', 'Mariam Ahmed', '+973 3333 1102', '+973 3333 1102', 'mariam@example.com', 'Muharraq', 'Muharraq Governorate', '203', '1129', '45', '3B', 'Behind Seef Mall Muharraq', 'Prefer evening delivery.'),
  ('00000000-0000-4000-8000-000000000303', 'Noora Hassan', '+973 3333 1103', '+973 3333 1103', 'noora@example.com', 'Budaiya', 'Northern Governorate', '555', '5521', '19', '2', 'Opposite coffee shop', 'WhatsApp when courier leaves.'),
  ('00000000-0000-4000-8000-000000000304', 'Fatima Ali', '+973 3333 1104', '+973 3333 1104', 'fatima@example.com', 'Riffa', 'Southern Governorate', '909', '1315', '27', 'Villa', 'Near Riffa Views gate', 'Leave with security if unavailable.')
on conflict (mobile) do update
set
  full_name = excluded.full_name,
  whatsapp = excluded.whatsapp,
  email = excluded.email,
  area = excluded.area,
  governorate = excluded.governorate,
  block = excluded.block,
  road = excluded.road,
  building = excluded.building,
  flat = excluded.flat,
  landmark = excluded.landmark,
  delivery_notes = excluded.delivery_notes;

insert into orders (
  id,
  order_number,
  customer_id,
  order_source,
  order_status,
  payment_status,
  payment_method,
  subtotal,
  discount_total,
  delivery_charge,
  grand_total,
  amount_paid,
  amount_due,
  staff_id,
  notes,
  created_at
)
values
  ('00000000-0000-4000-8000-000000000401', 'MSV-10001', '00000000-0000-4000-8000-000000000301', 'instagram', 'delivered', 'paid', 'benefitpay', 46.500, 0.000, 1.500, 48.000, 48.000, 0.000, null, 'Demo: paid Instagram order with delivery label and invoice.', now() - interval '2 hours'),
  ('00000000-0000-4000-8000-000000000402', 'MSV-10002', '00000000-0000-4000-8000-000000000302', 'whatsapp', 'out_for_delivery', 'cod', 'cash_on_delivery', 45.000, 0.000, 1.500, 46.500, 0.000, 46.500, null, 'Demo: COD delivery currently out with courier.', now() - interval '50 minutes'),
  ('00000000-0000-4000-8000-000000000403', 'MSV-10003', '00000000-0000-4000-8000-000000000303', 'walk_in', 'confirmed', 'partial', 'cash', 36.000, 1.000, 1.500, 36.500, 20.000, 16.500, null, 'Demo: partial payment order.', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000404', 'MSV-10004', '00000000-0000-4000-8000-000000000304', 'tiktok', 'returned', 'refunded', 'card', 32.500, 0.000, 0.000, 32.500, 32.500, 0.000, null, 'Demo: returned item for return/exchange testing.', now() - interval '12 days')
on conflict (order_number) do update
set
  customer_id = excluded.customer_id,
  order_source = excluded.order_source,
  order_status = excluded.order_status,
  payment_status = excluded.payment_status,
  payment_method = excluded.payment_method,
  subtotal = excluded.subtotal,
  discount_total = excluded.discount_total,
  delivery_charge = excluded.delivery_charge,
  grand_total = excluded.grand_total,
  amount_paid = excluded.amount_paid,
  amount_due = excluded.amount_due,
  notes = excluded.notes,
  created_at = excluded.created_at;

insert into order_items (
  id,
  order_id,
  product_variant_id,
  product_name_snapshot,
  variant_sku_snapshot,
  size_snapshot,
  color_snapshot,
  quantity,
  unit_price,
  discount,
  line_total
)
values
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000201', 'Satin Wrap Dress', 'MSV-DRS-SATIN-BLK-S', 'S', 'Black', 1, 32.500, 0.000, 32.500),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000208', 'Mini Pearl Clutch', 'MSV-BAG-CLUTCH-PNK-OS', 'One Size', 'Pink', 1, 14.000, 0.000, 14.000),
  ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000204', 'Pearl Trim Abaya', 'MSV-ABY-PEARL-ROS-S', 'S', 'Rose', 1, 45.000, 0.000, 45.000),
  ('00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000206', 'Soft Rib Boutique Top', 'MSV-TOP-RIB-IVY-M', 'M', 'Ivory', 2, 18.000, 1.000, 35.000),
  ('00000000-0000-4000-8000-000000000505', '00000000-0000-4000-8000-000000000404', '00000000-0000-4000-8000-000000000202', 'Satin Wrap Dress', 'MSV-DRS-SATIN-BLK-M', 'M', 'Black', 1, 32.500, 0.000, 32.500)
on conflict (id) do update
set
  product_variant_id = excluded.product_variant_id,
  product_name_snapshot = excluded.product_name_snapshot,
  variant_sku_snapshot = excluded.variant_sku_snapshot,
  size_snapshot = excluded.size_snapshot,
  color_snapshot = excluded.color_snapshot,
  quantity = excluded.quantity,
  unit_price = excluded.unit_price,
  discount = excluded.discount,
  line_total = excluded.line_total;

insert into payments (
  id,
  order_id,
  payment_method,
  payment_status,
  amount,
  reference_number,
  note,
  created_by,
  created_at
)
values
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000401', 'benefitpay', 'paid', 48.000, 'BENEFIT-DEMO-10001', 'Demo BenefitPay payment.', null, now() - interval '2 hours'),
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000402', 'cash_on_delivery', 'cod', 0.000, null, 'Collect on delivery.', null, now() - interval '50 minutes'),
  ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000403', 'cash', 'partial', 20.000, 'CASH-DEMO-10003', 'Deposit paid in boutique.', null, now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000704', '00000000-0000-4000-8000-000000000404', 'card', 'refunded', 32.500, 'CARD-REFUND-DEMO-10004', 'Refunded after return approval.', null, now() - interval '10 days')
on conflict (id) do update
set
  payment_method = excluded.payment_method,
  payment_status = excluded.payment_status,
  amount = excluded.amount,
  reference_number = excluded.reference_number,
  note = excluded.note,
  created_at = excluded.created_at;

insert into deliveries (
  id,
  order_id,
  customer_name,
  phone,
  governorate,
  area,
  block,
  road,
  building,
  flat,
  landmark,
  delivery_note,
  delivery_date,
  delivery_time_slot,
  courier_name,
  courier_phone,
  delivery_status,
  created_at
)
values
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000401', 'Sara Al Khalifa', '+973 3333 1101', 'Capital Governorate', 'Juffair', '324', '2417', '88', '12', 'Near Al Fateh Grand Mosque', 'Call before delivery.', current_date, '4:00 PM - 7:00 PM', 'Ali Courier', '+973 3999 2222', 'delivered', now() - interval '2 hours'),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000402', 'Mariam Ahmed', '+973 3333 1102', 'Muharraq Governorate', 'Muharraq', '203', '1129', '45', '3B', 'Behind Seef Mall Muharraq', 'Collect COD amount.', current_date, '6:00 PM - 9:00 PM', 'Hasan Courier', '+973 3999 3333', 'out_for_delivery', now() - interval '50 minutes'),
  ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000403', 'Noora Hassan', '+973 3333 1103', 'Northern Governorate', 'Budaiya', '555', '5521', '19', '2', 'Opposite coffee shop', 'WhatsApp when courier leaves.', current_date + 1, '10:00 AM - 1:00 PM', null, null, 'pending', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000604', '00000000-0000-4000-8000-000000000404', 'Fatima Ali', '+973 3333 1104', 'Southern Governorate', 'Riffa', '909', '1315', '27', 'Villa', 'Near Riffa Views gate', 'Returned to boutique.', current_date - 10, '2:00 PM - 5:00 PM', 'Ali Courier', '+973 3999 2222', 'returned', now() - interval '12 days')
on conflict (id) do update
set
  customer_name = excluded.customer_name,
  phone = excluded.phone,
  governorate = excluded.governorate,
  area = excluded.area,
  block = excluded.block,
  road = excluded.road,
  building = excluded.building,
  flat = excluded.flat,
  landmark = excluded.landmark,
  delivery_note = excluded.delivery_note,
  delivery_date = excluded.delivery_date,
  delivery_time_slot = excluded.delivery_time_slot,
  courier_name = excluded.courier_name,
  courier_phone = excluded.courier_phone,
  delivery_status = excluded.delivery_status,
  created_at = excluded.created_at;

insert into stock_movements (
  id,
  product_variant_id,
  movement_type,
  quantity,
  previous_quantity,
  new_quantity,
  reference_type,
  reference_id,
  note,
  created_by,
  created_at
)
values
  ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000201', 'opening_stock', 12, 0, 12, 'demo_seed', null, 'Demo seed: opening stock.', null, now() - interval '15 days'),
  ('00000000-0000-4000-8000-000000000802', '00000000-0000-4000-8000-000000000201', 'sale_deduction', -1, 12, 11, 'order', '00000000-0000-4000-8000-000000000401', 'Demo seed: stock deducted for MSV-10001.', null, now() - interval '2 hours'),
  ('00000000-0000-4000-8000-000000000803', '00000000-0000-4000-8000-000000000202', 'opening_stock', 8, 0, 8, 'demo_seed', null, 'Demo seed: opening stock.', null, now() - interval '15 days'),
  ('00000000-0000-4000-8000-000000000804', '00000000-0000-4000-8000-000000000202', 'sale_deduction', -1, 8, 7, 'order', '00000000-0000-4000-8000-000000000404', 'Demo seed: returned order sale deduction.', null, now() - interval '12 days'),
  ('00000000-0000-4000-8000-000000000805', '00000000-0000-4000-8000-000000000202', 'return_added', 1, 7, 8, 'return', '00000000-0000-4000-8000-000000000901', 'Demo seed: sellable return added back to stock.', null, now() - interval '10 days'),
  ('00000000-0000-4000-8000-000000000806', '00000000-0000-4000-8000-000000000203', 'purchase_stock', 5, 0, 5, 'purchase_order', '00000000-0000-4000-8000-000000000b01', 'Demo seed: purchase received.', null, now() - interval '7 days'),
  ('00000000-0000-4000-8000-000000000807', '00000000-0000-4000-8000-000000000204', 'purchase_stock', 5, 0, 5, 'purchase_order', '00000000-0000-4000-8000-000000000b01', 'Demo seed: purchase received.', null, now() - interval '7 days'),
  ('00000000-0000-4000-8000-000000000808', '00000000-0000-4000-8000-000000000204', 'sale_deduction', -1, 5, 4, 'order', '00000000-0000-4000-8000-000000000402', 'Demo seed: stock deducted for MSV-10002.', null, now() - interval '50 minutes'),
  ('00000000-0000-4000-8000-00000000080a', '00000000-0000-4000-8000-000000000206', 'opening_stock', 18, 0, 18, 'demo_seed', null, 'Demo seed: opening stock.', null, now() - interval '15 days'),
  ('00000000-0000-4000-8000-00000000080b', '00000000-0000-4000-8000-000000000206', 'sale_deduction', -2, 18, 16, 'order', '00000000-0000-4000-8000-000000000403', 'Demo seed: stock deducted for MSV-10003.', null, now() - interval '1 day'),
  ('00000000-0000-4000-8000-00000000080c', '00000000-0000-4000-8000-000000000207', 'opening_stock', 2, 0, 2, 'demo_seed', null, 'Demo seed: low stock variant.', null, now() - interval '15 days'),
  ('00000000-0000-4000-8000-00000000080d', '00000000-0000-4000-8000-000000000208', 'opening_stock', 8, 0, 8, 'demo_seed', null, 'Demo seed: opening stock.', null, now() - interval '15 days'),
  ('00000000-0000-4000-8000-00000000080e', '00000000-0000-4000-8000-000000000208', 'sale_deduction', -1, 8, 7, 'order', '00000000-0000-4000-8000-000000000401', 'Demo seed: stock deducted for MSV-10001.', null, now() - interval '2 hours'),
  ('00000000-0000-4000-8000-00000000080f', '00000000-0000-4000-8000-000000000209', 'opening_stock', 18, 0, 18, 'demo_seed', null, 'Demo seed: opening stock.', null, now() - interval '15 days'),
  ('00000000-0000-4000-8000-000000000810', '00000000-0000-4000-8000-000000000210', 'opening_stock', 6, 0, 6, 'demo_seed', null, 'Demo seed: opening stock.', null, now() - interval '15 days')
on conflict (id) do update
set
  movement_type = excluded.movement_type,
  quantity = excluded.quantity,
  previous_quantity = excluded.previous_quantity,
  new_quantity = excluded.new_quantity,
  reference_type = excluded.reference_type,
  reference_id = excluded.reference_id,
  note = excluded.note,
  created_at = excluded.created_at;

insert into returns (
  id,
  original_order_id,
  customer_id,
  return_type,
  reason,
  condition,
  refund_amount,
  exchange_order_id,
  status,
  staff_id,
  notes,
  created_at
)
values (
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000404',
  '00000000-0000-4000-8000-000000000304',
  'return',
  'size_issue',
  'sellable',
  32.500,
  null,
  'completed',
  null,
  'Demo: sellable returned dress added back to stock and refunded.',
  now() - interval '10 days'
)
on conflict (id) do update
set
  reason = excluded.reason,
  condition = excluded.condition,
  refund_amount = excluded.refund_amount,
  status = excluded.status,
  notes = excluded.notes,
  created_at = excluded.created_at;

insert into return_items (
  id,
  return_id,
  product_variant_id,
  quantity,
  action,
  created_at
)
values (
  '00000000-0000-4000-8000-000000000911',
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000202',
  1,
  'add_back_to_stock',
  now() - interval '10 days'
)
on conflict (id) do update
set
  quantity = excluded.quantity,
  action = excluded.action,
  created_at = excluded.created_at;

insert into suppliers (
  id,
  supplier_name,
  contact_person,
  phone,
  email,
  country,
  address,
  notes
)
values
  ('00000000-0000-4000-8000-000000000a01', 'Istanbul Boutique Textiles', 'Leyla Demir', '+90 555 0101', 'sales@istanbultextiles.example', 'Turkey', 'Istanbul Wholesale Market', 'Dresses, tops, and seasonal fabrics.'),
  ('00000000-0000-4000-8000-000000000a02', 'Dubai Occasion Accessories', 'Aisha Khan', '+971 55 010 2020', 'hello@dubaiaccessories.example', 'United Arab Emirates', 'Deira, Dubai', 'Evening bags and accessories.')
on conflict (id) do update
set
  supplier_name = excluded.supplier_name,
  contact_person = excluded.contact_person,
  phone = excluded.phone,
  email = excluded.email,
  country = excluded.country,
  address = excluded.address,
  notes = excluded.notes;

insert into purchase_orders (
  id,
  purchase_number,
  supplier_id,
  purchase_date,
  expected_arrival_date,
  actual_arrival_date,
  status,
  payment_status,
  subtotal,
  discount,
  shipping_cost,
  grand_total,
  notes,
  created_by,
  created_at
)
values
  ('00000000-0000-4000-8000-000000000b01', 'PO-10001', '00000000-0000-4000-8000-000000000a01', current_date - 8, current_date - 6, current_date - 7, 'received', 'paid', 180.000, 10.000, 12.000, 182.000, 'Demo: received stock for satin dresses and abayas.', null, now() - interval '8 days'),
  ('00000000-0000-4000-8000-000000000b02', 'PO-10002', '00000000-0000-4000-8000-000000000a02', current_date - 2, current_date + 5, null, 'ordered', 'partial', 95.000, 0.000, 8.000, 103.000, 'Demo: incoming accessories shipment.', null, now() - interval '2 days')
on conflict (purchase_number) do update
set
  supplier_id = excluded.supplier_id,
  purchase_date = excluded.purchase_date,
  expected_arrival_date = excluded.expected_arrival_date,
  actual_arrival_date = excluded.actual_arrival_date,
  status = excluded.status,
  payment_status = excluded.payment_status,
  subtotal = excluded.subtotal,
  discount = excluded.discount,
  shipping_cost = excluded.shipping_cost,
  grand_total = excluded.grand_total,
  notes = excluded.notes,
  created_at = excluded.created_at;

insert into purchase_order_items (
  id,
  purchase_order_id,
  product_variant_id,
  quantity_ordered,
  quantity_received,
  cost_price,
  line_total,
  created_at
)
values
  ('00000000-0000-4000-8000-000000000b11', '00000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-000000000203', 5, 5, 14.000, 70.000, now() - interval '8 days'),
  ('00000000-0000-4000-8000-000000000b12', '00000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-000000000204', 5, 5, 22.000, 110.000, now() - interval '8 days'),
  ('00000000-0000-4000-8000-000000000b13', '00000000-0000-4000-8000-000000000b02', '00000000-0000-4000-8000-000000000208', 8, 0, 6.000, 48.000, now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000b14', '00000000-0000-4000-8000-000000000b02', '00000000-0000-4000-8000-000000000209', 10, 0, 2.500, 25.000, now() - interval '2 days')
on conflict (id) do update
set
  quantity_ordered = excluded.quantity_ordered,
  quantity_received = excluded.quantity_received,
  cost_price = excluded.cost_price,
  line_total = excluded.line_total,
  created_at = excluded.created_at;

insert into expenses (
  id,
  category,
  amount,
  expense_date,
  payment_method,
  vendor,
  notes,
  attachment_url,
  created_by,
  created_at
)
values
  ('00000000-0000-4000-8000-000000000c01', 'packaging', 18.500, current_date, 'benefitpay', 'Bahrain Packaging Store', 'Pink delivery bags and invoice sleeves.', null, null, now() - interval '5 hours'),
  ('00000000-0000-4000-8000-000000000c02', 'marketing', 42.000, current_date - 3, 'card', 'Instagram Ads', 'Weekend collection promotion.', null, null, now() - interval '3 days'),
  ('00000000-0000-4000-8000-000000000c03', 'delivery', 12.000, current_date - 1, 'cash', 'Courier petty cash', 'Local delivery reimbursements.', null, null, now() - interval '1 day')
on conflict (id) do update
set
  category = excluded.category,
  amount = excluded.amount,
  expense_date = excluded.expense_date,
  payment_method = excluded.payment_method,
  vendor = excluded.vendor,
  notes = excluded.notes,
  attachment_url = excluded.attachment_url,
  created_at = excluded.created_at;

insert into audit_logs (id, action, table_name, record_id, user_id, metadata, created_at)
values
  ('00000000-0000-4000-8000-000000000d01', 'create_order', 'orders', '00000000-0000-4000-8000-000000000401', null, '{"source":"demo_seed","order_number":"MSV-10001"}'::jsonb, now() - interval '2 hours'),
  ('00000000-0000-4000-8000-000000000d02', 'add_stock', 'stock_movements', '00000000-0000-4000-8000-000000000806', null, '{"source":"demo_seed","purchase_number":"PO-10001"}'::jsonb, now() - interval '7 days'),
  ('00000000-0000-4000-8000-000000000d03', 'process_return', 'returns', '00000000-0000-4000-8000-000000000901', null, '{"source":"demo_seed","order_number":"MSV-10004"}'::jsonb, now() - interval '10 days')
on conflict (id) do update
set
  action = excluded.action,
  table_name = excluded.table_name,
  record_id = excluded.record_id,
  metadata = excluded.metadata,
  created_at = excluded.created_at;

select setval('order_number_seq', greatest((select last_value from order_number_seq), 10004), true);
select setval('purchase_number_seq', greatest((select last_value from purchase_number_seq), 10002), true);
