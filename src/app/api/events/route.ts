import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const eventSchema = z.object({
  schoolId: z.string().min(1, "School is required"),
  type: z.enum(["initial", "retake"]).default("initial"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().optional(),
  notes: z.string().optional(),
  classOrder: z.array(z.object({ grade: z.string(), teacher: z.string() })).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("schoolId");

  const where: Record<string, unknown> = { photographerId: session.userId };
  if (schoolId) where.schoolId = schoolId;

  const events = await prisma.event.findMany({
    where,
    include: {
      school: { select: { id: true, name: true } },
      _count: { select: { checkIns: true, photos: true, orders: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = eventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Verify school ownership
  const school = await prisma.school.findFirst({
    where: { id: parsed.data.schoolId, photographerId: session.userId },
  });
  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const event = await prisma.event.create({
    data: {
      type: parsed.data.type,
      date: new Date(parsed.data.date),
      startTime: parsed.data.startTime || null,
      notes: parsed.data.notes || null,
      classOrder: parsed.data.classOrder ? JSON.stringify(parsed.data.classOrder) : null,
      schoolId: parsed.data.schoolId,
      photographerId: session.userId,
    },
    include: {
      school: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}
