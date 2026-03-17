import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateOrderNumber } from "@/lib/orders";
import { z } from "zod";

// Public route: parents place orders from proof page (no auth required)
const parentOrderSchema = z.object({
  parentName: z.string().min(1, "Name is required"),
  parentEmail: z.string().email("Valid email is required"),
  paymentMethod: z.enum(["card", "venmo"]),
  items: z.array(
    z.object({
      packageId: z.string().min(1),
      studentId: z.string().min(1),
      photoId: z.string().optional(),
      quantity: z.number().int().min(1).default(1),
    })
  ).min(1, "At least one item is required"),
  proofToken: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  // This endpoint returns packages available for ordering (public for proof page use)
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    include: {
      school: {
        select: {
          id: true,
          name: true,
          paymentInstructions: true,
          packages: {
            where: { active: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY && !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  return NextResponse.json({
    packages: event.school.packages,
    schoolName: event.school.name,
    paymentInstructions: event.school.paymentInstructions,
    stripeEnabled: stripeConfigured,
  });
}

// Parent creates a Venmo/Zelle order (no auth, no Stripe)
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const body = await request.json();
  const parsed = parentOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Only handle venmo/zelle orders here; card orders go through /api/payments/checkout
  if (parsed.data.paymentMethod === "card") {
    return NextResponse.json(
      { error: "Card payments should use the /api/payments/checkout endpoint" },
      { status: 400 }
    );
  }

  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    include: { school: { select: { id: true } } },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Look up packages for pricing
  const packageIds = Array.from(new Set(parsed.data.items.map((i) => i.packageId)));
  const packages = await prisma.package.findMany({
    where: { id: { in: packageIds }, active: true, schoolId: event.school.id },
  });
  const priceMap = new Map(packages.map((p) => [p.id, p.price]));

  let totalAmount = 0;
  const itemsData = parsed.data.items.map((item) => {
    const unitPrice = priceMap.get(item.packageId) || 0;
    totalAmount += unitPrice * item.quantity;
    return {
      packageId: item.packageId,
      studentId: item.studentId,
      photoId: item.photoId || null,
      quantity: item.quantity,
      unitPrice,
    };
  });

  const orderNumber = await generateOrderNumber();

  const order = await prisma.order.create({
    data: {
      orderNumber,
      status: "awaiting_payment",
      source: "online",
      totalAmount,
      parentName: parsed.data.parentName,
      parentEmail: parsed.data.parentEmail,
      eventId: params.eventId,
      items: { create: itemsData },
    },
  });

  return NextResponse.json({
    order: {
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      status: order.status,
    },
  }, { status: 201 });
}
