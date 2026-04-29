import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const updateSchema = z.object({
  type: z.enum(["initial", "retake"]).optional(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  notes: z.string().optional(),
  classOrder: z.array(z.object({ grade: z.string(), teacher: z.string() })).optional(),
  status: z.enum(["scheduled", "in_progress", "completed"]).optional(),
  posesPerStudent: z.number().int().min(1).max(4).optional(),
  matchingMethod: z.enum(["sequence", "qr", "filename"]).optional(),
});

async function getEventForSession(eventId: string, organizationId: string | null) {
  return prisma.event.findFirst({
    where: { id: eventId, school: { organizationId: organizationId ?? undefined } },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const event = await prisma.event.findFirst({
    where: { id: params.eventId, school: { organizationId: session.organizationId ?? undefined } },
    include: {
      school: {
        select: {
          id: true,
          name: true,
          students: {
            select: { id: true, firstName: true, lastName: true, grade: true, teacher: true, studentId: true },
            orderBy: [{ grade: "asc" }, { lastName: "asc" }],
          },
        },
      },
      _count: { select: { checkIns: true, photos: true, orders: true } },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ event });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const existing = await getEventForSession(params.eventId, session.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.type) data.type = parsed.data.type;
  if (parsed.data.date) data.date = new Date(parsed.data.date);
  if (parsed.data.startTime !== undefined) data.startTime = parsed.data.startTime || null;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes || null;
  if (parsed.data.classOrder) data.classOrder = JSON.stringify(parsed.data.classOrder);
  if (parsed.data.status) data.status = parsed.data.status;
  if (parsed.data.posesPerStudent !== undefined) data.posesPerStudent = parsed.data.posesPerStudent;
  if (parsed.data.matchingMethod) data.matchingMethod = parsed.data.matchingMethod;

  const event = await prisma.event.update({
    where: { id: params.eventId },
    data,
    include: {
      school: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ event });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const existing = await getEventForSession(params.eventId, session.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await prisma.event.delete({ where: { id: params.eventId } });
  return NextResponse.json({ success: true });
}
