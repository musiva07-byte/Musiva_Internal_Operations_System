export function formatBhd(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `BHD ${amount.toFixed(3)}`;
}
