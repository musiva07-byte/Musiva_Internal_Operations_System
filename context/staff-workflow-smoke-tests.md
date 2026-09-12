# Staff Workflow Smoke Tests

## Why this document exists

On 2026-09-12, staff reported that Product Catalog search could find a product by its product
code (`16B1ACD5` — KURTHI CODE SET), but the same search in New Sale's item picker returned
"No products found." This directly blocked sales at the till. Root cause: New Sale's product
lookup only searched `products.name`, not `products.sku` — a narrower field list than Product
Catalog's own search, discovered only because a staff member happened to search by code that day.

This checklist exists so the next regression like that is caught **before** a deploy, not after
a staff complaint. Run it manually after any change touching product search, stock filtering,
order creation, or navigation — and always after a deploy (see the "Post-deploy" section at the
bottom). See also the automated regression suite: `src/app/admin/orders/new/new-sale-critical-path.test.ts`.

Use a temporary/safe test product and customer for anything that writes data, and clean up
afterward (delete the test order/customer, restore stock) — see the manual QA pattern used
throughout this session's fixes.

---

## A. New Sale

- [ ] Create a new customer by mobile number (one not already in the system)
- [ ] Select an existing customer by searching their mobile number
- [ ] Search for a product by **product code/SKU** (the exact bug: e.g. `16B1ACD5`)
- [ ] Search for the same product by **product name**
- [ ] Search for the same product by **color**
- [ ] Search for the same product by **size**
- [ ] Add a variant to the cart
- [ ] Try to set quantity above available stock — confirm it's blocked (capped at stock)
- [ ] Continue to Payment
- [ ] Continue to Review
- [ ] Create the order
- [ ] Confirm the success/print popup appears with the right order number and total
- [ ] Confirm stock was deducted for the exact variant sold (check Stock Management or the DB)

## B. Product Catalog

- [ ] Search by product name
- [ ] Search by product code/SKU
- [ ] Category, status, and website filters still narrow results correctly
- [ ] Pagination moves between pages without losing filters
- [ ] Open a product from page 3+ of a filtered/paginated view, edit it, save, click "Back to
      catalog" — confirm it returns to the same page/filter position, not page 1
- [ ] Product image displays; a product with no image shows a safe placeholder (no crash)
- [ ] Changing a product's website status (published/draft/hidden) saves and reflects immediately

## C. Stock Management

- [ ] Search by product name, code, color, and size
- [ ] "Receive stock" / Add stock modal completes and shows a success confirmation
- [ ] "Correct quantity" completes and shows a success confirmation with the new quantity
- [ ] Stock History shows the resulting movement record
- [ ] No raw Supabase/Postgres error text is ever shown to staff — only friendly messages

## D. Orders

- [ ] Orders list tabs (Today, New, Confirmed, Preparing, Completed, Cancelled, All) load
- [ ] Open an order's detail page
- [ ] Edit an order item's color/size/quantity
- [ ] Save shows the confirmation (old vs new, stock impact, totals impact) before committing
- [ ] Cancel / mark duplicate works, and stock is restored when the option is chosen
- [ ] Print Receipt / Print Label / Combined print open correctly

## E. Website Requests

- [ ] List loads and tabs filter correctly
- [ ] Open a request's detail page
- [ ] Mark contacted / Convert to order (or whichever actions are enabled) completes with visible
      feedback — never a silent failure
- [ ] Converting to an order does not double-deduct stock or create a duplicate order

## F. Navigation

- [ ] Back links preserve context where it matters (Product Catalog return-to-page/filter,
      order detail → edit → back)
- [ ] Sticky action bars (Cancel/Save) stay visible and usable on long forms (New Product, New
      Sale, Product Edit)
- [ ] Success dialogs offer clear next actions (View / Back to list / Continue editing, etc.),
      not just a bare "OK"

---

## Post-deploy staff QA checklist

Run this immediately after every deploy to production (`operation.moosivabh.com`), using real
but disposable test data:

1. New Sale: search for a real, known product code (e.g. `16B1ACD5`) — confirm results appear.
2. Create one test sale for a temporary test customer.
3. Confirm stock deducted correctly for the sold variant.
4. Confirm the receipt/success popup appears and Print Receipt opens.
5. Product Catalog: open a product from a filtered/paginated page, edit, save, confirm "Back to
   catalog" returns to that same page/filter — not page 1.
6. Stock Management loads and search works.
7. Orders list loads and shows the test order just created.
8. Clean up: cancel/delete the test order, restore the deducted stock, remove the test customer.

If any step fails, do not consider the deploy complete — investigate before staff start their
shift.

---

## Development safety rule

> Any change to Product Catalog search, product SKU fields, product variant queries, website
> visibility, stock filtering, or the New Sale item picker must run the New Sale search parity
> tests (`src/lib/services/order-product-search.test.ts` and
> `src/app/admin/orders/new/new-sale-critical-path.test.ts`) before merge/deploy.
>
> Internal sales visibility is separate from public website visibility. Website hidden products
> can still be sold internally if active and in stock.

(Also recorded in `AGENTS.md` / `CLAUDE.md`, section "Development Safety Rules".)
