export function formatBhd(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `BHD ${amount.toFixed(3)}`;
}

/** Product Catalog's "Price" column: always the customer-facing selling price, never a cost
 *  figure. When a product's active variants all share one price, show it plainly; when they
 *  differ, show "From BHD X.XXX" using the lowest active price — never the highest, and never
 *  an average — so staff aren't misled into thinking every variant costs the lowest amount, but
 *  can still tell at a glance where prices start. */
export function formatCatalogPriceRange(
  minSellingPrice: number | null,
  maxSellingPrice: number | null,
): string {
  if (minSellingPrice === null) return "—";
  if (maxSellingPrice !== null && maxSellingPrice !== minSellingPrice) {
    return `From ${formatBhd(minSellingPrice)}`;
  }
  return formatBhd(minSellingPrice);
}

/** Format a supplier-currency amount.  Symbol is a prefix e.g. "₹" for INR. */
export function formatSupplierCurrency(
  value: number | string | null | undefined,
  currency = "INR",
): string {
  const amount = Number(value ?? 0);
  const symbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
    AED: "AED ",
    SAR: "SAR ",
  };
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${amount.toFixed(2)}`;
}

/** Display exchange rate as "1 BHD = ₹{rate}" */
export function formatExchangeRate(
  rateInrPerBhd: number | null | undefined,
  quoteCurrency = "INR",
): string {
  if (rateInrPerBhd === null || rateInrPerBhd === undefined || rateInrPerBhd <= 0) {
    return "—";
  }
  const symbols: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
  const sym = symbols[quoteCurrency] ?? quoteCurrency;
  return `1 BHD = ${sym}${Number(rateInrPerBhd).toFixed(2)}`;
}
