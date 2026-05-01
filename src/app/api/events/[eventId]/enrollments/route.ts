import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const upsertSchema = z.object({
  studentId: z.string().min(1),
  grade: z.string(),
  teacher: z.string().optional(),
});

async function verifyEventAccess(eventId: string, organizationId: string | null) {
  return prisma.event.findFirst({
    where: { id: eventId, school: { organizationId: organizationId ?? undefined } },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const event = await verifyEventAccess(params.eventId, session.organizationId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const body = await request.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const db = prisma as any;
  const enrollment = await db.enrollment.upsert({
    where: { studentId_eventId: { studentId: parsed.data.studentId, eventId: params.eventId } },
    create: {
      studentId: parsed.data.studentId,
      eventId: params.eventId,
      grade: parsed.data.grade,
      teacher: parsed.data.teacher || null,
    },
    update: {
      grade: parsed.data.grade,
      teacher: parsed.data.teacher || null,
    },
  });

  return NextResponse.json({ enrollment });
}
