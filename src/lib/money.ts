export const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export function formatMoney(n: number | string | null | undefined, currency = "usd"): string {
  const v = Number(n ?? 0);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
      minimumFractionDigits: 2,
    }).format(v);
  } catch {
    return usd.format(v);
  }
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  stripe: "Stripe",
  ach: "ACH",
  check: "Cheque",
  cash: "Efectivo",
  wire: "Transferencia",
  other: "Otro",
};
