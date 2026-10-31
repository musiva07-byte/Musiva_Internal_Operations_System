import { describe, expect, it } from "vitest";
import { summarizeVariantStock, summarizeVariantStocks, type StockMovementGroup } from "./stock-history";

type Type = StockMovementGroup["movement_type"];

const live = (movement_type: Type, balance_change: number): StockMovementGroup => ({
  variant_id: "v1",
  movement_type,
  order_cancelled: false,
  balance_change,
});
const cancelled = (movement_type: Type, balance_change: number): StockMovementGroup => ({
  ...live(movement_type, balance_change),
  order_cancelled: true,
});

/** Total / Sold, after asserting history reconciles to the balance. */
function figures(currentStock: number, groups: StockMovementGroup[]) {
  const summary = summarizeVariantStock("v1", currentStock, groups);
  expect(summary.unexplained_quantity).toBe(0);
  return { total: summary.total_stock_quantity, sold: summary.net_sold_quantity, inStock: summary.current_stock_quantity };
}

describe("summarizeVariantStock", () => {
  it("simple history: Total 10, Sold 7, In Stock 3", () => {
    expect(figures(3, [live("opening_stock", 10), live("sale_deduction", -7)])).toEqual({ total: 10, sold: 7, inStock: 3 });
  });

  it("partial sale", () => {
    expect(figures(9, [live("opening_stock", 10), live("sale_deduction", -1)])).toEqual({ total: 10, sold: 1, inStock: 9 });
  });

  it("multiple receipts add up, across opening stock and purchases", () => {
    expect(figures(23, [live("opening_stock", 10), live("purchase_stock", 6), live("purchase_stock", 7)])).toEqual({
      total: 23,
      sold: 0,
      inStock: 23,
    });
  });

  it("zero stock with no history is a real zero", () => {
    expect(figures(0, [])).toEqual({ total: 0, sold: 0, inStock: 0 });
  });

  it("sold out", () => {
    expect(figures(0, [live("opening_stock", 2), live("sale_deduction", -2)])).toEqual({ total: 2, sold: 2, inStock: 0 });
  });

  it("cancelled order with stock restored: not sold", () => {
    expect(figures(5, [live("opening_stock", 5), cancelled("sale_deduction", -2), cancelled("cancelled_order_restore", 2)])).toEqual({
      total: 5,
      sold: 0,
      inStock: 5,
    });
  });

  it("restored cancellation alongside real sales counts only the real sales", () => {
    expect(
      figures(4, [live("opening_stock", 5), live("sale_deduction", -1), cancelled("sale_deduction", -2), cancelled("cancelled_order_restore", 2)]),
    ).toEqual({ total: 5, sold: 1, inStock: 4 });
  });

  it("cancelled order without restoring stock: not sold, and reported", () => {
    const summary = summarizeVariantStock("v1", 3, [live("opening_stock", 5), cancelled("sale_deduction", -2)]);
    expect(summary).toMatchObject({
      total_stock_quantity: 5,
      net_sold_quantity: 0,
      cancelled_not_restored_quantity: 2,
      unexplained_quantity: 0,
    });
  });

  it("customer return added back to stock reduces Sold", () => {
    expect(figures(4, [live("opening_stock", 5), live("sale_deduction", -2), live("return_added", 1)])).toEqual({
      total: 5,
      sold: 1,
      inStock: 4,
    });
  });

  it("damaged return stays sold: the movement has no effect on the balance", () => {
    expect(figures(3, [live("opening_stock", 5), live("sale_deduction", -2), live("damaged", 0)])).toEqual({
      total: 5,
      sold: 2,
      inStock: 3,
    });
  });

  it("exchange: the old item comes back, the new item counts as sold", () => {
    const old = figures(5, [live("opening_stock", 5), live("sale_deduction", -1), live("return_added", 1)]);
    const replacement = figures(4, [live("opening_stock", 5), live("sale_deduction", -1)]);
    expect(old).toEqual({ total: 5, sold: 0, inStock: 5 });
    expect(replacement).toEqual({ total: 5, sold: 1, inStock: 4 });
  });

  it("treats a legacy exchange_deduction as sold", () => {
    expect(figures(4, [live("opening_stock", 5), live("exchange_deduction", -1)]).sold).toBe(1);
  });

  it("order-edit correction nets against the sale it changes, on both variants", () => {
    // Size swapped M → L: M's sale is undone by return_added, L takes a new deduction.
    expect(figures(5, [live("opening_stock", 5), live("sale_deduction", -1), live("return_added", 1)]).sold).toBe(0);
    expect(figures(4, [live("opening_stock", 5), live("sale_deduction", -1)]).sold).toBe(1);
  });

  it("upward correction changes neither Total Stock nor Sold, and is reported", () => {
    const summary = summarizeVariantStock("v1", 7, [live("opening_stock", 5), live("manual_adjustment", 2)]);
    expect(summary).toMatchObject({ total_stock_quantity: 5, net_sold_quantity: 0, corrections_quantity: 2, unexplained_quantity: 0 });
  });

  it("downward correction is not a sale", () => {
    const summary = summarizeVariantStock("v1", 3, [live("opening_stock", 5), live("manual_adjustment", -2)]);
    expect(summary).toMatchObject({ total_stock_quantity: 5, net_sold_quantity: 0, corrections_quantity: -2 });
  });

  it("a return with no recorded sale can't make Sold negative", () => {
    const summary = summarizeVariantStock("v1", 6, [live("opening_stock", 5), live("return_added", 1)]);
    expect(summary).toMatchObject({ total_stock_quantity: 5, net_sold_quantity: 0, corrections_quantity: 1, unexplained_quantity: 0 });
  });

  it("over-restored cancellation is reported, not counted as stock received", () => {
    const summary = summarizeVariantStock("v1", 6, [live("opening_stock", 5), cancelled("sale_deduction", -1), cancelled("cancelled_order_restore", 2)]);
    expect(summary).toMatchObject({ total_stock_quantity: 5, net_sold_quantity: 0, corrections_quantity: 1, unexplained_quantity: 0 });
  });

  it("stock with no movements at all: Total Stock unknown, never invented", () => {
    const summary = summarizeVariantStock("v1", 4, []);
    expect(summary).toMatchObject({
      history_status: "no_history",
      total_stock_quantity: null,
      net_sold_quantity: null,
      unexplained_quantity: 4,
    });
  });

  it("history that doesn't reach the balance: incomplete, so neither figure is presented", () => {
    const summary = summarizeVariantStock("v1", 5, [live("opening_stock", 10), live("sale_deduction", -7)]);
    expect(summary).toMatchObject({
      history_status: "incomplete",
      total_stock_quantity: null,
      net_sold_quantity: null,
      unexplained_quantity: 2,
    });
  });

  it("opening stock only", () => {
    expect(figures(2, [live("opening_stock", 2)])).toEqual({ total: 2, sold: 0, inStock: 2 });
  });

  it("reversed corrections net to nothing, as on A LINE KAFTAN GOWN / POWDER BLUE / L", () => {
    const groups = [live("opening_stock", 1), live("manual_adjustment", 4), live("manual_adjustment", -4)];
    const summary = summarizeVariantStock("v1", 1, groups);
    expect(summary).toMatchObject({ history_status: "complete", total_stock_quantity: 1, net_sold_quantity: 0, corrections_quantity: 0 });
  });

  it("a returned sale, as on CURIDHAR MATERIAL / BLACK& ORANGE", () => {
    expect(figures(1, [live("opening_stock", 1), live("sale_deduction", -1), live("return_added", 1)])).toEqual({
      total: 1,
      sold: 0,
      inStock: 1,
    });
  });

  it("zero stock and zero movements is verified, not missing", () => {
    expect(summarizeVariantStock("v1", 0, []).history_status).toBe("complete");
  });

  it("every movement lands in exactly one bucket, so nothing is double-counted", () => {
    const groups = [
      live("opening_stock", 20),
      live("purchase_stock", 6),
      live("sale_deduction", -9),
      live("cancelled_order_restore", 1),
      live("return_added", 2),
      live("manual_adjustment", -3),
      live("damaged", 0),
      cancelled("sale_deduction", -2),
      cancelled("cancelled_order_restore", 1),
    ];
    const summary = summarizeVariantStock("v1", 16, groups);
    expect(summary.unexplained_quantity).toBe(0);
    expect(
      summary.total_stock_quantity! -
        summary.net_sold_quantity! +
        summary.corrections_quantity -
        summary.cancelled_not_restored_quantity,
    ).toBe(summary.current_stock_quantity);
  });
});

describe("summarizeVariantStocks", () => {
  it("keeps each variant's figures separate, and includes variants with no movements", () => {
    const groups: StockMovementGroup[] = [
      { ...live("opening_stock", 10), variant_id: "brown-3xl" },
      { ...live("sale_deduction", -7), variant_id: "brown-3xl" },
      { ...live("opening_stock", 4), variant_id: "cream-3xl" },
    ];
    const result = summarizeVariantStocks(
      [
        { id: "brown-3xl", stock_quantity: 3 },
        { id: "cream-3xl", stock_quantity: 4 },
        { id: "new", stock_quantity: 0 },
      ],
      groups,
    );
    expect(result.get("brown-3xl")).toMatchObject({ total_stock_quantity: 10, net_sold_quantity: 7 });
    expect(result.get("cream-3xl")).toMatchObject({ total_stock_quantity: 4, net_sold_quantity: 0 });
    expect(result.get("new")).toMatchObject({ total_stock_quantity: 0, net_sold_quantity: 0 });
  });
});
