import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canTransitionStatus } from "@/lib/orders";

const updateSchema = z.object({
  status: z.string().optional(),
  parentName: z.string().optional(),
  parentEmail: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
});

async function verifyOrderAccess(orderId: string, organizationId: string | null) {
  return prisma.order.findFirst({
    where: {
      id: orderId,
      event: { school: { organizationId: organizationId ?? undefined } },
    },
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
          package: { select: { name: true, contents: true, digital: true } },
          student: { select: { firstName: true, lastName: true, grade: true } },
          photo: { select: { id: true, filename: true, storagePath: true } },
        },
      },
      downloads: true,
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const order = await verifyOrderAccess(params.orderId, session.organizationId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const existing = await verifyOrderAccess(params.orderId, session.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Validate status transition
  if (parsed.data.status && !canTransitionStatus(existing.status, parsed.data.status)) {
    return NextResponse.json(
      { error: `Cannot transition from "${existing.status}" to "${parsed.data.status}"` },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.status) data.status = parsed.data.status;
  if (parsed.data.parentName !== undefined) data.parentName = parsed.data.parentName || null;
  if (parsed.data.parentEmail !== undefined) data.parentEmail = parsed.data.parentEmail || null;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes || null;

  const order = await prisma.order.update({
    where: { id: params.orderId },
    data,
  });

  return NextResponse.json({ order });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const existing = await verifyOrderAccess(params.orderId, session.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Only allow deleting pending/awaiting_payment orders
  if (existing.status !== "pending" && existing.status !== "awaiting_payment") {
    return NextResponse.json(
      { error: "Cannot delete an order that has been paid" },
      { status: 400 }
    );
  }

  await prisma.order.delete({ where: { id: params.orderId } });
  return NextResponse.json({ success: true });
}
