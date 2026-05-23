export const PAYMENT_METHODS = {
  cash: "cash",
  benefitPay: "benefitpay",
  card: "card",
  bankTransfer: "bank_transfer",
  paymentLink: "payment_link",
  cashOnDelivery: "cash_on_delivery",
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];
