import { prisma } from "./db";

export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SP-${year}-`;

  // Find the highest existing order number for this year
  const latest = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });

  let nextNum = 1;
  if (latest) {
    const numPart = latest.orderNumber.replace(prefix, "");
    nextNum = parseInt(numPart, 10) + 1;
  }

  return `${prefix}${nextNum.toString().padStart(4, "0")}`;
}

export const ORDER_STATUSES = [
  "pending",
  "awaiting_payment",
  "paid",
  "sent_to_lab",
  "printed",
  "delivered",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Status can only move forward, never backward
export function canTransitionStatus(
  current: string,
  next: string
): boolean {
  const currentIdx = ORDER_STATUSES.indexOf(current as OrderStatus);
  const nextIdx = ORDER_STATUSES.indexOf(next as OrderStatus);
  if (currentIdx === -1 || nextIdx === -1) return false;
  return nextIdx > currentIdx;
}
