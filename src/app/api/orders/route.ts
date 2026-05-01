import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateOrderNumber } from "@/lib/orders";

const createOrderSchema = z.object({
  eventId: z.string().min(1),
  source: z.enum(["online", "paper"]).default("paper"),
  parentName: z.string().optional(),
  parentEmail: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      packageId: z.string().min(1),
      studentId: z.string().min(1),
      photoId: z.string().optional(),
      quantity: z.number().int().min(1).default(1),
    })
  ).min(1, "At least one item is required"),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const eventId = searchParams.get("eventId");
  const schoolId = searchParams.get("schoolId");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {
    event: { school: { organizationId: session.organizationId ?? undefined } },
  };

  if (status) where.status = status;
  if (eventId) where.eventId = eventId;
  if (schoolId) where.event = { ...(where.event as object), schoolId };
  if (search) {
    where.OR = [
      { orderNumber: { contains: search } },
      { parentName: { contains: search } },
      { parentEmail: { contains: search } },
    ];
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      event: {
        select: {
          id: true,
          date: true,
          school: { select: { id: true, name: true } },
        },
      },
      items: {
        include: {
          package: { select: { name: true } },
          student: { select: { firstName: true, lastName: true } },
        },
      },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Aggregate stats
  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "pending" || o.status === "awaiting_payment").length,
    paid: orders.filter((o) => o.status === "paid").length,
    fulfilled: orders.filter((o) => ["sent_to_lab", "printed", "delivered"].includes(o.status)).length,
    totalRevenue: orders
      .filter((o) => o.status !== "pending" && o.status !== "awaiting_payment")
      .reduce((sum, o) => sum + o.totalAmount, 0),
  };

  return NextResponse.json({ orders, stats });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Verify event belongs to this org
  const event = await prisma.event.findFirst({
    where: { id: parsed.data.eventId, school: { organizationId: session.organizationId ?? undefined } },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Look up package prices and calculate total
  const packageIds = Array.from(new Set(parsed.data.items.map((i) => i.packageId)));
  const packages = await prisma.package.findMany({
    where: { id: { in: packageIds } },
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
      status: "pending",
      source: parsed.data.source,
      totalAmount,
      parentName: parsed.data.parentName || null,
      parentEmail: parsed.data.parentEmail || null,
      notes: parsed.data.notes || null,
      eventId: parsed.data.eventId,
      items: { create: itemsData },
    },
    include: {
      items: {
        include: {
          package: { select: { name: true } },
          student: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return NextResponse.json({ order }, { status: 201 });
}
