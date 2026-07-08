export function formatBhd(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `BHD ${amount.toFixed(3)}`;
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
