import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAuthState } from "@/lib/auth/session";
import { canViewReports } from "@/lib/auth/permissions";

// Columns exported per type — intentionally narrow to avoid leaking sensitive data
// to roles that lack cost/finance visibility.
const EXPORT_TYPES = ["products", "customers", "orders", "stock-movements", "deliveries"] as const;
type ExportType = (typeof EXPORT_TYPES)[number];

function isValidType(value: string): value is ExportType {
  return (EXPORT_TYPES as readonly string[]).includes(value);
}

function toCsvRow(values: unknown[]): string {
  return values
    .map((v) => {
      const s = v == null ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    })
    .join(",");
}

function buildCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines: string[] = [toCsvRow(headers)];
  for (const row of rows) {
    lines.push(toCsvRow(headers.map((h) => row[h])));
  }
  return lines.join("\n");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
): Promise<NextResponse> {
  // Auth check — only roles that can view reports may export
  const { profile } = await getCurrentAuthState();
  if (!profile || !canViewReports(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { type } = await params;
  if (!isValidType(type)) {
    return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  let csv = "";
  const filename = `musiva-${type}-${new Date().toISOString().slice(0, 10)}.csv`;

  try {
    if (type === "products") {
      const { data, error } = await supabase
        .from("product_variants")
        .select("variant_sku, color, size, stock_quantity, minimum_stock, selling_price, status, products(name, sku, category_id)")
        .neq("status", "archived")
        .order("variant_sku", { ascending: true })
        .limit(5000);

      if (error) throw error;

      const headers = ["product_name", "product_sku", "variant_sku", "color", "size", "stock_quantity", "minimum_stock", "selling_price", "status"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (data ?? []).map((r: any) => ({
        product_name: r.products?.name ?? "",
        product_sku: r.products?.sku ?? "",
        variant_sku: r.variant_sku,
        color: r.color,
        size: r.size,
        stock_quantity: r.stock_quantity,
        minimum_stock: r.minimum_stock,
        selling_price: r.selling_price,
        status: r.status,
      }));
      csv = buildCsv(headers, rows);
    }

    if (type === "customers") {
      const { data, error } = await supabase
        .from("customers")
        .select("id, full_name, mobile, whatsapp, email, governorate, area, block, road, building, flat, landmark, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);

      if (error) throw error;
      const headers = ["id", "full_name", "mobile", "whatsapp", "email", "governorate", "area", "block", "road", "building", "flat", "landmark", "created_at"];
      csv = buildCsv(headers, (data ?? []) as Record<string, unknown>[]);
    }

    if (type === "orders") {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const { data, error } = await supabase
        .from("orders")
        .select("order_number, order_status, order_source, payment_method, payment_status, grand_total, discount_total, delivery_charge, amount_paid, amount_due, created_at, customers(full_name, mobile)")
        .gte("created_at", oneYearAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(5000);

      if (error) throw error;

      const headers = ["order_number", "order_status", "order_source", "payment_method", "payment_status", "grand_total", "discount_total", "delivery_charge", "amount_paid", "amount_due", "customer_name", "customer_mobile", "created_at"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (data ?? []).map((r: any) => ({
        order_number: r.order_number,
        order_status: r.order_status,
        order_source: r.order_source,
        payment_method: r.payment_method,
        payment_status: r.payment_status,
        grand_total: r.grand_total,
        discount_total: r.discount_total,
        delivery_charge: r.delivery_charge,
        amount_paid: r.amount_paid,
        amount_due: r.amount_due,
        customer_name: r.customers?.full_name ?? "",
        customer_mobile: r.customers?.mobile ?? "",
        created_at: r.created_at,
      }));
      csv = buildCsv(headers, rows);
    }

    if (type === "stock-movements") {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, movement_type, quantity, previous_quantity, new_quantity, reference_type, reference_id, note, created_at, product_variants(variant_sku, color, size, products(name))")
        .order("created_at", { ascending: false })
        .limit(5000);

      if (error) throw error;

      const headers = ["id", "product_name", "variant_sku", "color", "size", "movement_type", "quantity", "previous_quantity", "new_quantity", "reference_type", "reference_id", "note", "created_at"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (data ?? []).map((r: any) => ({
        id: r.id,
        product_name: r.product_variants?.products?.name ?? "",
        variant_sku: r.product_variants?.variant_sku ?? "",
        color: r.product_variants?.color ?? "",
        size: r.product_variants?.size ?? "",
        movement_type: r.movement_type,
        quantity: r.quantity,
        previous_quantity: r.previous_quantity,
        new_quantity: r.new_quantity,
        reference_type: r.reference_type,
        reference_id: r.reference_id,
        note: r.note,
        created_at: r.created_at,
      }));
      csv = buildCsv(headers, rows);
    }

    if (type === "deliveries") {
      const { data, error } = await supabase
        .from("deliveries")
        .select("id, order_id, customer_name, phone, governorate, area, block, road, building, flat, landmark, delivery_date, delivery_status, courier_name, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);

      if (error) throw error;
      const headers = ["id", "order_id", "customer_name", "phone", "governorate", "area", "block", "road", "building", "flat", "landmark", "delivery_date", "delivery_status", "courier_name", "created_at"];
      csv = buildCsv(headers, (data ?? []) as Record<string, unknown>[]);
    }
  } catch (err) {
    console.error("[Export] Failed:", err);
    return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 });
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
